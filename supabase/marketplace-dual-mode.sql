-- SORTI v2. Additive; preserves v1 orders. Review and apply the whole transaction.
begin;
alter table public.listings add column if not exists condition text;
alter table public.listings add column if not exists defects text not null default '';
alter table public.listings add column if not exists allow_meetup boolean not null default false;
alter table public.listings add column if not exists allow_shipping boolean not null default false;
alter table public.listings add column if not exists meetup_note text not null default '';
alter table public.listings add column if not exists shipping_note text not null default '';
alter table public.listings add column if not exists shipping_fee numeric(12,2) not null default 0 check(shipping_fee>=0);
alter table public.listings add column if not exists version integer not null default 1;
alter table public.listings add column if not exists client_request_id uuid;
create unique index if not exists sorti_listing_request on public.listings(seller_id,client_request_id);
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check check(status in ('active','reserved','sold','archived'));
alter table public.orders add column if not exists workflow_version integer not null default 1;
alter table public.orders add column if not exists delivery_method text check(delivery_method in ('meetup','shipping'));
alter table public.orders add column if not exists version integer not null default 1;
alter table public.orders add column if not exists checkout_batch_id uuid;
alter table public.orders add column if not exists group_key text;
alter table public.orders add column if not exists request_payload jsonb;
alter table public.orders add column if not exists decision_reason text;
alter table public.orders add column if not exists accepted_at timestamptz;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists seller_handed_over_at timestamptz;
alter table public.orders add column if not exists buyer_received_at timestamptz;
alter table public.orders add column if not exists cancel_requested_by uuid references auth.users(id);
alter table public.orders add column if not exists meetup jsonb;
alter table public.orders add column if not exists shipment jsonb;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check(status in ('pending','paid','shipped','completed','cancelled','requested','accepted','fulfilling','rejected'));
-- Face-to-face requires no recipient data; shipping and legacy rows retain validation.
alter table public.orders alter column recipient_name drop not null;
alter table public.orders alter column recipient_phone drop not null;
alter table public.orders alter column shipping_address drop not null;
alter table public.orders drop constraint if exists orders_recipient_name_check;
alter table public.orders drop constraint if exists orders_recipient_phone_check;
alter table public.orders drop constraint if exists orders_shipping_address_check;
alter table public.orders drop constraint if exists sorti_order_recipient;
alter table public.orders add constraint sorti_order_recipient check (
 (workflow_version=2 and delivery_method='meetup') or
 (coalesce(length(btrim(recipient_name)),0)>0 and coalesce(length(btrim(recipient_phone)),0)>0 and coalesce(length(btrim(shipping_address)),0)>0));
create unique index if not exists sorti_order_request on public.orders(buyer_id,checkout_batch_id,group_key);
alter table public.order_items add column if not exists image_path_snapshot text;
alter table public.order_items add column if not exists condition_snapshot text;
alter table public.order_items add column if not exists delivery_terms_snapshot jsonb;
alter table public.order_items add column if not exists is_active_allocation boolean not null default false;
-- Never choose a winner automatically if historic data is inconsistent.
do $$ begin
 if exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id
   where o.workflow_version=1 and o.status<>'cancelled' group by i.listing_id having count(*)>1) then
   raise exception 'Existing duplicate sales require manual review; no data changed';
 end if;
end $$;
update public.order_items i set is_active_allocation=true from public.orders o
 where o.id=i.order_id and o.workflow_version=1 and o.status<>'cancelled';
create unique index if not exists sorti_single_allocation on public.order_items(listing_id) where is_active_allocation;
create table if not exists public.order_events (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 actor_id uuid references auth.users(id), event_type text not null, occurred_at timestamptz not null default now(), metadata jsonb not null default '{}'
);
create table if not exists public.order_issues (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 opened_by uuid not null references auth.users(id), details text not null check(length(btrim(details)) between 1 and 3000),
 opened_at timestamptz not null default now(), buyer_resolved_at timestamptz, seller_resolved_at timestamptz, resolved_at timestamptz
);
create index if not exists sorti_order_events_order on public.order_events(order_id,occurred_at);
create index if not exists sorti_order_issues_order on public.order_issues(order_id);
do $$ declare t text; begin
 foreach t in array array['order_events','order_issues'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('drop policy if exists sorti_order_party on public.%I',t);
  execute format('create policy sorti_order_party on public.%I for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (select auth.uid()) in (o.buyer_id,o.seller_id)))',t);
 end loop;
end $$;

-- A small marketplace deliberately serializes transaction mutations. This is a
-- correctness-first lock; replace with finer row locking only after load testing.
create or replace function public.sorti_listing_v2_guard() returns trigger
language plpgsql set search_path='' as $$ begin
 perform pg_catalog.pg_advisory_xact_lock(837492011);
 if current_user in ('authenticated','anon') and TG_OP='INSERT' and new.status not in ('active','archived') then raise exception '新商品只能為上架或下架狀態' using errcode='42501'; end if;
 if current_user in ('authenticated','anon') and TG_OP='UPDATE' and
   (old.status in ('reserved','sold') or new.status in ('reserved','sold') or
    exists(select 1 from public.order_items i where i.listing_id=old.id and i.is_active_allocation)) then
  raise exception '商品已有有效交易，不能修改或重新上架' using errcode='42501';
 end if;
 if new.allow_meetup or new.allow_shipping then
  if new.condition is null or new.condition not in ('全新','近全新','正常使用','有瑕疵但可使用')
    or (new.condition='有瑕疵但可使用' and length(btrim(new.defects))=0)
    or (new.allow_shipping and length(btrim(new.shipping_note))=0) then
   raise exception '請填寫商品狀況、瑕疵及有效寄送方式' using errcode='22023';
  end if;
 end if;
 if TG_OP='UPDATE' then
  new.version:=old.version+1;
 end if;
 return new;
end $$;
drop trigger if exists sorti_listing_v2_guard on public.listings;
create trigger sorti_listing_v2_guard before insert or update on public.listings for each row execute function public.sorti_listing_v2_guard();

create or replace function public.create_market_requests(p_batch uuid,p_items jsonb,p_recipient jsonb default '{}')
returns uuid[] language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ids uuid[]; oid uuid; result uuid[]:='{}'; g record; it record; payload jsonb; subtotal numeric; fee numeric;
begin
 if actor is null then raise exception '請先登入' using errcode='42501'; end if;
 if p_batch is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception '請選擇有效商品' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(837492011);
 payload:=jsonb_build_object('digest',md5(jsonb_build_object('items',p_items,'recipient',p_recipient)::text));
 if exists(select 1 from public.orders where buyer_id=actor and checkout_batch_id=p_batch) then
  if exists(select 1 from public.orders where buyer_id=actor and checkout_batch_id=p_batch and request_payload is distinct from payload) then raise exception '請求內容已變更，請重新確認後送出' using errcode='22023'; end if;
  return array(select id from public.orders where buyer_id=actor and checkout_batch_id=p_batch order by group_key);
 end if;
 select array_agg((x->>'id')::uuid) into ids from jsonb_array_elements(p_items) x;
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception '商品不可重複' using errcode='22023'; end if;
 perform id from public.listings where id=any(ids) order by id for update;
 if (select count(*) from public.listings where id=any(ids))<>cardinality(ids) then raise exception '商品不存在或已下架'; end if;
 for it in select l.*, x->>'method' method,(x->>'version')::integer requested_version from jsonb_array_elements(p_items) x join public.listings l on l.id=(x->>'id')::uuid loop
  if it.status<>'active' or it.seller_id=actor or it.version is distinct from it.requested_version or it.method not in ('meetup','shipping') or it.method is null
   or (it.method='meetup' and not it.allow_meetup) or (it.method='shipping' and not it.allow_shipping)
   or exists(select 1 from public.order_items where listing_id=it.id and is_active_allocation) then
   raise exception '商品狀態、價格或交易方式已變更，請重新確認' using errcode='22023';
  end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_items) x where x->>'method'='shipping') and
  (coalesce(length(btrim(p_recipient->>'name')),0)=0 or coalesce(length(btrim(p_recipient->>'phone')),0)=0 or coalesce(length(btrim(p_recipient->>'address')),0)=0) then raise exception '請填寫收件人、電話及地址' using errcode='22023'; end if;
 for g in select l.seller_id,x->>'method' method,sum(l.price) subtotal,max(l.shipping_fee) fee
  from jsonb_array_elements(p_items) x join public.listings l on l.id=(x->>'id')::uuid group by l.seller_id,x->>'method' order by l.seller_id,x->>'method' loop
  subtotal:=g.subtotal; fee:=case when g.method='shipping' then g.fee else 0 end;
  insert into public.orders(buyer_id,seller_id,recipient_name,recipient_phone,shipping_address,payment_method,subtotal,shipping_fee,total_amount,status,workflow_version,delivery_method,checkout_batch_id,group_key,request_payload)
   values(actor,g.seller_id,case when g.method='shipping' then btrim(p_recipient->>'name') else null end,
    case when g.method='shipping' then btrim(p_recipient->>'phone') else null end,case when g.method='shipping' then btrim(p_recipient->>'address') else null end,
    'cod',subtotal,fee,subtotal+fee,'requested',2,g.method,p_batch,g.seller_id::text||':'||g.method,payload) returning id into oid;
  insert into public.order_items(order_id,listing_id,title_snapshot,price_snapshot,image_path_snapshot,condition_snapshot,delivery_terms_snapshot)
   select oid,l.id,l.title,l.price,l.image_path,l.condition,jsonb_build_object('version',l.version,'meetup_note',l.meetup_note,'shipping_note',l.shipping_note,'shipping_fee',l.shipping_fee,'location',l.location)
   from jsonb_array_elements(p_items) x join public.listings l on l.id=(x->>'id')::uuid where l.seller_id=g.seller_id and x->>'method'=g.method;
  insert into public.order_events(order_id,actor_id,event_type) values(oid,actor,'requested');
  result:=array_append(result,oid);
 end loop;
 delete from public.cart_items where user_id=actor and listing_id=any(ids);
 return result;
end $$;

create or replace function public.market_order_action(p_order_id uuid,p_action text,p_version integer,p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); o public.orders%rowtype; seller boolean; m jsonb; issue public.order_issues%rowtype;
begin
 if actor is null then raise exception '請先登入' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(837492011);
 select * into o from public.orders where id=p_order_id for update;
 if not found or actor not in(o.buyer_id,o.seller_id) then raise exception '無法存取此訂單' using errcode='42501'; end if;
 if o.workflow_version<>2 then raise exception '請使用既有訂單操作' using errcode='22023'; end if;
 if o.version<>p_version then raise exception '訂單已更新，請重新整理後操作' using errcode='22023'; end if;
 seller:=actor=o.seller_id;
 if p_action in ('accept','reject','cancel') then
  if o.status<>'requested' or (p_action in ('accept','reject') and not seller) or (p_action='cancel' and seller) then raise exception '目前狀態無法執行此操作' using errcode='42501'; end if;
  if p_action='accept' then
   perform l.id from public.listings l join public.order_items i on i.listing_id=l.id where i.order_id=o.id order by l.id for update of l;
   if exists(select 1 from public.order_items i join public.listings l on l.id=i.listing_id where i.order_id=o.id and (l.status<>'active' or l.version<>(i.delivery_terms_snapshot->>'version')::integer or exists(select 1 from public.order_items j where j.listing_id=l.id and j.is_active_allocation))) then raise exception '商品已保留、售出或條款變更，無法接受' using errcode='22023'; end if;
   update public.order_items set is_active_allocation=true where order_id=o.id;
   update public.listings set status='reserved' where id in(select listing_id from public.order_items where order_id=o.id);
   update public.orders set status='accepted',accepted_at=now() where id=o.id;
   update public.orders z set status='rejected',decision_reason='商品已被其他訂單保留',version=version+1,updated_at=now() where z.id<>o.id and z.status='requested' and exists(select 1 from public.order_items a join public.order_items b on a.listing_id=b.listing_id where a.order_id=z.id and b.order_id=o.id);
  else
   update public.orders set status=case when p_action='reject' then 'rejected' else 'cancelled' end,decision_reason=left(coalesce(p_payload->>'reason',''),1000) where id=o.id;
  end if;
 else
  if o.status not in ('accepted','fulfilling') then raise exception '訂單已結束或尚未接受' using errcode='22023'; end if;
  if exists(select 1 from public.order_issues where order_id=o.id and resolved_at is null) and p_action<>'resolve_issue' then raise exception '請先協調解決交易問題' using errcode='22023'; end if;
  if o.cancel_requested_by is not null and p_action not in ('agree_cancel','decline_cancel') then raise exception '請先回覆取消提議' using errcode='22023'; end if;
  case p_action
  when 'request_cancel' then
   if o.shipment is not null or o.seller_handed_over_at is not null or o.buyer_received_at is not null then raise exception '交付已開始，請改為提出交易問題'; end if;
   update public.orders set cancel_requested_by=actor,decision_reason=left(coalesce(p_payload->>'reason',''),1000) where id=o.id;
  when 'agree_cancel','decline_cancel' then
   if o.cancel_requested_by is null or o.cancel_requested_by=actor or o.shipment is not null or o.seller_handed_over_at is not null or o.buyer_received_at is not null then raise exception '無法回覆此取消提議'; end if;
   update public.orders set cancel_requested_by=null,status=case when p_action='agree_cancel' then 'cancelled' else status end where id=o.id;
   if p_action='agree_cancel' then
    update public.order_items set is_active_allocation=false where order_id=o.id;
    update public.listings l set status='active' where l.status='reserved' and exists(select 1 from public.order_items i where i.order_id=o.id and i.listing_id=l.id) and not exists(select 1 from public.order_items i where i.listing_id=l.id and i.is_active_allocation);
   end if;
  when 'propose_meetup' then
   if o.delivery_method<>'meetup' or o.seller_handed_over_at is not null or o.buyer_received_at is not null or coalesce(length(btrim(p_payload->>'place')),0)=0 or (p_payload->>'starts_at')::timestamptz<=now() or p_payload->>'starts_at' is null then raise exception '請填寫有效的未來面交時間與地點'; end if;
   m:=jsonb_build_object('version',coalesce((o.meetup->>'version')::integer,0)+1,'proposed_by',actor,'starts_at',(p_payload->>'starts_at')::timestamptz,'place',left(p_payload->>'place',500),'notes',left(coalesce(p_payload->>'notes',''),1000),'confirmed',false);
   update public.orders set meetup=m where id=o.id;
  when 'confirm_meetup' then
   if o.delivery_method<>'meetup' or o.meetup is null or o.meetup->>'proposed_by'=actor::text or (o.meetup->>'version')::integer is distinct from (p_payload->>'proposal_version')::integer then raise exception '面交安排已改變，請確認最新版本'; end if;
   update public.orders set meetup=jsonb_set(meetup,'{confirmed}','true') where id=o.id;
  when 'handover' then
   if o.delivery_method<>'meetup' or coalesce((o.meetup->>'confirmed')::boolean,false)=false then raise exception '請先讓雙方確認面交安排'; end if;
   if (seller and o.seller_handed_over_at is not null) or (not seller and o.buyer_received_at is not null) then raise exception '你已確認交付，請重新整理'; end if;
   update public.orders set status='fulfilling',seller_handed_over_at=case when seller then now() else seller_handed_over_at end,buyer_received_at=case when not seller then now() else buyer_received_at end where id=o.id;
  when 'ship' then
   if not seller or o.delivery_method<>'shipping' or o.shipment is not null or p_payload->>'dispatched_at' is null or (p_payload->>'dispatched_at')::timestamptz>now() then raise exception '請填寫實際寄件日期，且只能由賣家寄件'; end if;
   update public.orders set status='fulfilling',shipment=jsonb_build_object('carrier',left(coalesce(p_payload->>'carrier',''),200),'dispatched_at',(p_payload->>'dispatched_at')::timestamptz,'tracking_number',left(coalesce(p_payload->>'tracking_number',''),200),'note',left(coalesce(p_payload->>'note',''),1000),'marked_at',now()) where id=o.id;
  when 'receive' then
   if seller or o.delivery_method<>'shipping' or o.shipment is null then raise exception '請待賣家寄件後，由買家確認收到'; end if;
   update public.orders set buyer_received_at=now() where id=o.id;
  when 'open_issue' then
   if coalesce(length(btrim(p_payload->>'details')),0) not between 1 and 3000 then raise exception '請填寫交易問題（最多 3000 字）'; end if;
   insert into public.order_issues(order_id,opened_by,details) values(o.id,actor,btrim(p_payload->>'details'));
  when 'resolve_issue' then
   select * into issue from public.order_issues where order_id=o.id and id=(p_payload->>'issue_id')::uuid and resolved_at is null for update;
   if not found then raise exception '問題已更新，請重新整理'; end if;
   update public.order_issues set buyer_resolved_at=case when not seller then now() else buyer_resolved_at end,seller_resolved_at=case when seller then now() else seller_resolved_at end where id=issue.id;
   update public.order_issues set resolved_at=now() where id=issue.id and buyer_resolved_at is not null and seller_resolved_at is not null;
  else raise exception '未知的交易操作' using errcode='22023';
  end case;
 end if;
 update public.orders set version=version+1,updated_at=now() where id=o.id;
 update public.orders z set status='completed',completed_at=now() where z.id=o.id and z.status='fulfilling' and z.cancel_requested_by is null and not exists(select 1 from public.order_issues i where i.order_id=z.id and i.resolved_at is null) and ((z.delivery_method='meetup' and z.seller_handed_over_at is not null and z.buyer_received_at is not null) or (z.delivery_method='shipping' and z.shipment is not null and z.buyer_received_at is not null));
 if exists(select 1 from public.orders where id=o.id and status='completed') then update public.listings set status='sold' where id in(select listing_id from public.order_items where order_id=o.id); end if;
 insert into public.order_events(order_id,actor_id,event_type,metadata) values(o.id,actor,p_action,case when p_action='propose_meetup' then jsonb_build_object('proposal_version',m->'version') else '{}'::jsonb end);
end $$;

-- Invalidate stale unaccepted requests after seller edits without touching accepted sales.
create or replace function public.sorti_invalidate_requests() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if old.status in ('active','archived') and new.status<>'reserved' then
  update public.orders o set status='rejected',decision_reason='商品或交易條款已變更，請重新確認',version=version+1,updated_at=now()
   where o.workflow_version=2 and o.status='requested' and exists(select 1 from public.order_items i where i.order_id=o.id and i.listing_id=new.id);
 end if;
 return new;
end $$;
drop trigger if exists sorti_invalidate_requests on public.listings;
create trigger sorti_invalidate_requests after update on public.listings for each row execute function public.sorti_invalidate_requests();

create or replace function public.market_order_conversation(p_order_id uuid,p_listing_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); o public.orders%rowtype; cid uuid;
begin
 select * into o from public.orders where id=p_order_id;
 if actor is null or not found or actor not in(o.buyer_id,o.seller_id) or not exists(select 1 from public.order_items where order_id=o.id and listing_id=p_listing_id) then raise exception '無法存取此交易對話' using errcode='42501'; end if;
 insert into public.conversations(listing_id,buyer_id,seller_id) values(p_listing_id,o.buyer_id,o.seller_id) on conflict(listing_id,buyer_id,seller_id) do update set listing_id=excluded.listing_id returning id into cid;
 return cid;
end $$;
revoke all on function public.market_order_conversation(uuid,uuid) from public,anon;
grant execute on function public.market_order_conversation(uuid,uuid) to authenticated;
alter table public.messages add column if not exists client_request_id uuid;
create unique index if not exists sorti_message_request on public.messages(sender_id,client_request_id);
-- Message insert and conversation sort time must succeed together.
create or replace function public.sorti_message_timestamp() returns trigger language plpgsql security definer set search_path='' as $$ begin
 update public.conversations set last_message_at=greatest(last_message_at,new.created_at) where id=new.conversation_id;
 return new;
end $$;
revoke all on function public.sorti_message_timestamp() from public,anon,authenticated;
drop trigger if exists sorti_message_timestamp on public.messages;
create trigger sorti_message_timestamp after insert on public.messages for each row execute function public.sorti_message_timestamp();
-- Preserve legacy cancellations while releasing the migrated allocation.
create or replace function public.sorti_legacy_cancel_allocation() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.workflow_version=1 and new.status='cancelled' and old.status<>'cancelled' then update public.order_items set is_active_allocation=false where order_id=new.id; end if;
 return new;
end $$;
revoke all on function public.sorti_legacy_cancel_allocation() from public,anon,authenticated;
drop trigger if exists sorti_legacy_cancel_allocation on public.orders;
create trigger sorti_legacy_cancel_allocation after update on public.orders for each row execute function public.sorti_legacy_cancel_allocation();

-- Old clients must not bypass v2 reservations. v1 history and transition RPC remain.
create or replace function public.create_orders_from_cart(p_listing_ids uuid[],p_recipient_name text,p_recipient_phone text,p_shipping_address text)
returns uuid[] language plpgsql set search_path='' as $$ begin raise exception '請更新拾序版本，改用送出購買請求' using errcode='22023'; end $$;
revoke all on function public.create_market_requests(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.create_market_requests(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.market_order_action(uuid,text,integer,jsonb) from public,anon;
grant execute on function public.market_order_action(uuid,text,integer,jsonb) to authenticated;
revoke all on function public.sorti_listing_v2_guard() from public,anon,authenticated;
revoke all on function public.sorti_invalidate_requests() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
