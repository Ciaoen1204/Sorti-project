-- SORTI proposed handover flow. User approved this flow on 2026-10-11; run whole file after marketplace-dual-mode.sql.
-- Preserves all orders, messages and historic meetup arrangements.
begin;
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
  when 'propose_meetup','confirm_meetup' then
   raise exception '面交安排功能已移除，請透過交易聊聊約定時間與地點' using errcode='22023';
  when 'handover' then
   if o.delivery_method<>'meetup' then raise exception '此訂單不是面交交易'; end if;
   if not seller and o.seller_handed_over_at is null then raise exception '請先由賣家確認已交付，再由買家確認收貨' using errcode='22023'; end if;
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

revoke all on function public.market_order_action(uuid,text,integer,jsonb) from public,anon;
grant execute on function public.market_order_action(uuid,text,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
