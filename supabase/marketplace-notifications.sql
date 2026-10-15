-- Review before applying. Additive notification infrastructure; retains all transaction data.
begin;
create table if not exists public.notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 chat boolean not null default true, orders boolean not null default true
);
create table if not exists public.market_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null, kind text not null check(kind in ('chat','orders')),
 title text not null, body text not null, target jsonb not null,
 created_at timestamptz not null default now(), read_at timestamptz,
 push_state text not null default 'pending', attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(), locked_until timestamptz,
 unique(user_id,event_key)
);
create index if not exists sorti_notifications_user_created on public.market_notifications(user_id,created_at desc);
create table if not exists public.push_devices (
 token text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 platform text not null check(platform in ('android','web')), updated_at timestamptz not null default now()
);
create index if not exists sorti_push_device_owner on public.push_devices(user_id);
create table if not exists public.notification_deliveries (
 notification_id uuid references public.market_notifications(id) on delete cascade,
 token text not null, primary key(notification_id,token)
);
alter table public.notification_preferences enable row level security;
alter table public.market_notifications enable row level security;
alter table public.push_devices enable row level security;
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_preferences,public.market_notifications,public.push_devices,public.notification_deliveries from anon,authenticated;
grant all on public.notification_preferences,public.market_notifications,public.push_devices,public.notification_deliveries to service_role;
grant select,insert,update on public.notification_preferences to authenticated;
grant select on public.market_notifications to authenticated;
grant update(read_at) on public.market_notifications to authenticated;
grant select,insert,update,delete on public.push_devices to authenticated;
drop policy if exists sorti_notification_prefs on public.notification_preferences;
create policy sorti_notification_prefs on public.notification_preferences to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists sorti_notification_read on public.market_notifications;
create policy sorti_notification_read on public.market_notifications for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists sorti_notification_seen on public.market_notifications;
create policy sorti_notification_seen on public.market_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists sorti_push_owner on public.push_devices;
create policy sorti_push_owner on public.push_devices to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists sorti_delivery_server_only on public.notification_deliveries;
create policy sorti_delivery_server_only on public.notification_deliveries to authenticated using(false) with check(false);
create schema if not exists sorti_private;
revoke all on schema sorti_private from public,anon,authenticated;
create or replace function sorti_private.notify_market_message() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.conversations; recipient uuid;
begin
 select * into c from public.conversations where id=new.conversation_id;
 if new.sender_id=c.buyer_id then recipient:=c.seller_id;
 elsif new.sender_id=c.seller_id then recipient:=c.buyer_id;
 else return new; end if;
 insert into public.market_notifications(user_id,event_key,kind,title,body,target)
 values(recipient,'message:'||new.id,'chat','收到新的買賣訊息','交易對象傳來訊息，點此查看聊聊。',jsonb_build_object('conversationId',c.id,'listingId',c.listing_id)) on conflict do nothing;
 return new;
end $$;
create or replace function sorti_private.notify_market_order() returns trigger language plpgsql security definer set search_path='' as $$
declare o public.orders; recipient uuid;
begin
 select * into o from public.orders where id=new.order_id;
 foreach recipient in array array[o.buyer_id,o.seller_id] loop
  if recipient is distinct from new.actor_id then
   insert into public.market_notifications(user_id,event_key,kind,title,body,target)
   values(recipient,'order-event:'||new.id,'orders','交易有新進度',(case new.event_type when 'requested' then '收到新的購買請求' when 'accept' then '賣家已接受訂單' when 'reject' then '賣家未接受訂單' when 'ship' then '賣家已寄出商品，請留意收貨' when 'handover' then '面交交付進度已更新' when 'receive' then '買家已確認收到商品' when 'cancel' then '訂單已取消' when 'request_cancel' then '交易對象提出取消申請' when 'open_issue' then '交易對象提出交易問題' when 'resolve_issue' then '交易問題有新的回覆' else '訂單有新的互動，點此查看最新狀態。' end),jsonb_build_object('orderId',o.id,'eventType',new.event_type)) on conflict do nothing;
  end if;
 end loop;
 return new;
end $$;
revoke all on function sorti_private.notify_market_message(),sorti_private.notify_market_order() from public,anon,authenticated;
drop trigger if exists sorti_notify_message on public.messages;
create trigger sorti_notify_message after insert on public.messages for each row execute function sorti_private.notify_market_message();
drop trigger if exists sorti_notify_order on public.order_events;
create trigger sorti_notify_order after insert on public.order_events for each row execute function sorti_private.notify_market_order();
create or replace function public.claim_market_notification_push() returns setof public.market_notifications language sql security definer set search_path='' as $$
 update public.market_notifications n set locked_until=now()+interval '2 minutes',attempts=attempts+1
 where id in (select id from public.market_notifications where push_state='pending' and attempts<8 and next_attempt_at<=now() and (locked_until is null or locked_until<now()) order by created_at for update skip locked limit 50)
 returning n.*;
$$;
revoke all on function public.claim_market_notification_push() from public,anon,authenticated;
grant execute on function public.claim_market_notification_push() to service_role;
notify pgrst,'reload schema';
commit;
