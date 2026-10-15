-- Review and apply the ENTIRE file after approval. Requires dual-mode and handover-flow migrations.
-- Additive only. Does not replace market_order_action or alter the approved handover flow.
begin;
alter table public.listings add column if not exists delivery_options jsonb;
alter table public.orders add column if not exists shipping_channel text;
alter table public.orders add column if not exists pickup_store jsonb;
create or replace function public.sorti_delivery_options_guard() returns trigger language plpgsql set search_path='' as $$
declare o jsonb; total integer;
begin
 if new.delivery_options is null then return new; end if;
 if jsonb_typeof(new.delivery_options) is distinct from 'array' then raise exception '交易方式必須為清單' using errcode='22023'; end if;
 total:=jsonb_array_length(new.delivery_options);
 if total not between 1 and 6 or total<>(select count(distinct x->>'channel') from jsonb_array_elements(new.delivery_options) x) then raise exception '請選擇交易方式且不可重複' using errcode='22023'; end if;
 for o in select value from jsonb_array_elements(new.delivery_options) loop
  if coalesce(o->>'channel','') not in ('meetup','seven_eleven','family_mart','hi_life','ok_mart','home_delivery')
    or jsonb_typeof(o->'fee') is distinct from 'number' then raise exception '無效交易管道或運費' using errcode='22023'; end if;
  if (o->>'fee')::numeric<0 or (o->>'fee')::numeric>9999999999 or (o->>'fee')::numeric<>trunc((o->>'fee')::numeric)
    or (o->>'channel'='meetup' and (o->>'fee')::numeric<>0) then raise exception '運費必須是有效非負整數' using errcode='22023'; end if;
 end loop;
 new.allow_meetup:=exists(select 1 from jsonb_array_elements(new.delivery_options) x where x->>'channel'='meetup');
 new.allow_shipping:=exists(select 1 from jsonb_array_elements(new.delivery_options) x where x->>'channel'<>'meetup');
 new.shipping_fee:=coalesce((select max((x->>'fee')::numeric) from jsonb_array_elements(new.delivery_options) x where x->>'channel'<>'meetup'),0);
 new.meetup_note:=coalesce((select x->>'note' from jsonb_array_elements(new.delivery_options) x where x->>'channel'='meetup'),'');
 new.shipping_note:=coalesce((select string_agg((case x->>'channel' when 'seven_eleven' then '7-ELEVEN' when 'family_mart' then '全家' when 'hi_life' then '萊爾富' when 'ok_mart' then 'OK 超商' else '宅配' end)||case when coalesce(x->>'note','')<>'' then '：'||(x->>'note') else '' end,'、') from jsonb_array_elements(new.delivery_options) x where x->>'channel'<>'meetup'),'');
 return new;
end $$;
drop trigger if exists sorti_delivery_options_guard on public.listings;
-- Runs before sorti_listing_v2_guard (alphabetical trigger order).
create trigger sorti_delivery_options_guard before insert or update on public.listings for each row execute function public.sorti_delivery_options_guard();
create or replace function public.create_market_requests(p_batch uuid,p_items jsonb,p_recipient jsonb default '{}')
returns uuid[] language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ids uuid[]; oid uuid; result uuid[]:='{}'; g record; it record; payload jsonb; subtotal numeric; fee numeric; destination text; pickup jsonb;
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
 for it in select l.*, x->>'method' method,coalesce(x->>'channel',x->>'method') channel,(x->>'version')::integer requested_version from jsonb_array_elements(p_items) x join public.listings l on l.id=(x->>'id')::uuid loop
  if it.status<>'active' or it.seller_id=actor or it.version is distinct from it.requested_version or it.method not in ('meetup','shipping') or it.method is null
   or (it.method='meetup' and not it.allow_meetup) or (it.method='shipping' and not it.allow_shipping)
   or exists(select 1 from public.order_items where listing_id=it.id and is_active_allocation) then
   raise exception '商品狀態、價格或交易方式已變更，請重新確認' using errcode='22023';
  end if;
  if it.delivery_options is not null then
    if not exists(select 1 from jsonb_array_elements(it.delivery_options) o where o->>'channel'=it.channel)
      or (it.method='meetup') is distinct from (it.channel='meetup') then
      raise exception '交易管道已變更，請重新確認' using errcode='22023'; end if;
  elsif it.channel is distinct from it.method then
    raise exception '賣家尚未提供這個寄送管道' using errcode='22023';
  end if;
 end loop;
 for g in select l.seller_id,x->>'method' method,coalesce(x->>'channel',x->>'method') channel,sum(l.price) subtotal,
  max(case when l.delivery_options is null then l.shipping_fee else
    (select (o->>'fee')::numeric from jsonb_array_elements(l.delivery_options) o where o->>'channel'=coalesce(x->>'channel',x->>'method')) end) fee
  from jsonb_array_elements(p_items) x join public.listings l on l.id=(x->>'id')::uuid
  group by l.seller_id,x->>'method',coalesce(x->>'channel',x->>'method')
  order by l.seller_id,x->>'method',coalesce(x->>'channel',x->>'method') loop
  pickup:=null; destination:=null;
  if g.method='shipping' then
    if coalesce(length(btrim(p_recipient->>'name')),0)=0 or coalesce(length(btrim(p_recipient->>'phone')),0)=0 then
      raise exception '請填寫收件人與電話' using errcode='22023'; end if;
    if g.channel in ('seven_eleven','family_mart','hi_life','ok_mart') then
      pickup:=p_recipient->'stores'->g.channel;
      if coalesce(length(btrim(pickup->>'name')),0)=0 or coalesce(length(btrim(pickup->>'code')),0)=0 or coalesce(length(btrim(pickup->>'address')),0)=0 then
        raise exception '請填寫門市名稱、店號及地址' using errcode='22023'; end if;
      destination:=btrim(pickup->>'address');
    else
      destination:=btrim(p_recipient->>'address');
      if coalesce(length(destination),0)=0 then raise exception '請填寫收件地址' using errcode='22023'; end if;
    end if;
  end if;
  subtotal:=g.subtotal; fee:=case when g.method='shipping' then g.fee else 0 end;
  insert into public.orders(buyer_id,seller_id,recipient_name,recipient_phone,shipping_address,payment_method,subtotal,shipping_fee,total_amount,status,workflow_version,delivery_method,checkout_batch_id,group_key,request_payload,shipping_channel,pickup_store)
   values(actor,g.seller_id,case when g.method='shipping' then btrim(p_recipient->>'name') else null end,
    case when g.method='shipping' then btrim(p_recipient->>'phone') else null end,destination,
    'cod',subtotal,fee,subtotal+fee,'requested',2,g.method,p_batch,g.seller_id::text||':'||g.method||':'||g.channel,payload,case when g.method='shipping' then g.channel else null end,pickup) returning id into oid;
  insert into public.order_items(order_id,listing_id,title_snapshot,price_snapshot,image_path_snapshot,condition_snapshot,delivery_terms_snapshot)
   select oid,l.id,l.title,l.price,l.image_path,l.condition,jsonb_build_object('version',l.version,'meetup_note',l.meetup_note,'shipping_note',l.shipping_note,'shipping_fee',l.shipping_fee,'location',l.location,'shipping_channel',g.channel,'delivery_options',l.delivery_options)
   from jsonb_array_elements(p_items) x join public.listings l on l.id=(x->>'id')::uuid where l.seller_id=g.seller_id and x->>'method'=g.method and coalesce(x->>'channel',x->>'method')=g.channel;
  insert into public.order_events(order_id,actor_id,event_type) values(oid,actor,'requested');
  result:=array_append(result,oid);
 end loop;
 delete from public.cart_items where user_id=actor and listing_id=any(ids);
 return result;
end $$;

revoke all on function public.create_market_requests(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.create_market_requests(uuid,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
