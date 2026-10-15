-- Run the entire file once for the buyer/seller marketplace update.
-- Existing orders/listings/messages are preserved. Safe to rerun.
begin;

-- Resolve participant access without recursive listings/conversations RLS checks.
create or replace function public.sorti_can_view_listing(p_listing_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.orders o join public.order_items i on i.order_id=o.id
      where i.listing_id=p_listing_id and o.buyer_id=auth.uid())
    or exists (select 1 from public.conversations c where c.listing_id=p_listing_id
      and auth.uid() in (c.buyer_id,c.seller_id))
  )
$$;
revoke all on function public.sorti_can_view_listing(uuid) from public, anon;
grant execute on function public.sorti_can_view_listing(uuid) to authenticated;

drop policy if exists sorti_listing_read on public.listings;
drop policy if exists sorti_listing_read_guard on public.listings;
create policy sorti_listing_read on public.listings for select to authenticated using (
  status = 'active' or seller_id = (select auth.uid())
  or public.sorti_can_view_listing(id)
);
create policy sorti_listing_read_guard on public.listings as restrictive for select to authenticated using (
  status = 'active' or seller_id = (select auth.uid())
  or public.sorti_can_view_listing(id)
);
drop policy if exists sorti_listing_update_guard on public.listings;
create policy sorti_listing_update_guard on public.listings as restrictive for update to authenticated
  using (seller_id=(select auth.uid()) and status in ('active','archived'))
  with check (seller_id=(select auth.uid()) and status in ('active','archived'));
drop policy if exists sorti_listing_delete_guard on public.listings;
create policy sorti_listing_delete_guard on public.listings as restrictive for delete to authenticated
  using (seller_id=(select auth.uid()) and status='archived'
    and not exists (select 1 from public.order_items i where i.listing_id=listings.id));
drop policy if exists sorti_cart_available on public.cart_items;
create policy sorti_cart_available on public.cart_items as restrictive for insert to authenticated
  with check (exists (select 1 from public.listings l where l.id=listing_id
    and l.status='active' and l.seller_id<>(select auth.uid())));
drop policy if exists sorti_cart_available_update on public.cart_items;
create policy sorti_cart_available_update on public.cart_items as restrictive for update to authenticated
  with check (exists (select 1 from public.listings l where l.id=listing_id
    and l.status='active' and l.seller_id<>(select auth.uid())));

create or replace function public.transition_market_order(p_order_id uuid, p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  purchase public.orders%rowtype;
begin
  if actor is null then raise exception '請先登入' using errcode='42501'; end if;
  if not exists (select 1 from public.orders o where o.id=p_order_id
    and actor in (o.buyer_id,o.seller_id)) then
    raise exception '無法存取此訂單' using errcode='42501';
  end if;
  -- Match checkout lock order: listings before orders; preserve price snapshots.
  perform l.id from public.listings l join public.order_items i on i.listing_id=l.id
    where i.order_id=p_order_id order by l.id for update of l;
  select * into purchase from public.orders where id=p_order_id for update;
  if not found or actor not in (purchase.buyer_id,purchase.seller_id) then
    raise exception '無法存取此訂單' using errcode='42501';
  end if;
  if p_action='ship' and actor=purchase.seller_id and purchase.status='pending' then
    update public.orders set status='shipped', updated_at=now() where id=p_order_id;
  elsif p_action='complete' and actor=purchase.buyer_id and purchase.status='shipped' then
    update public.orders set status='completed', updated_at=now() where id=p_order_id;
  elsif p_action='cancel' and purchase.status='pending' then
    update public.orders set status='cancelled', updated_at=now() where id=p_order_id;
    update public.listings l set status='active', updated_at=now()
      where l.status='sold' and exists (select 1 from public.order_items i where i.order_id=p_order_id and i.listing_id=l.id)
      and not exists (select 1 from public.order_items i join public.orders o on o.id=i.order_id
        where i.listing_id=l.id and o.status<>'cancelled');
  else
    raise exception '目前訂單狀態無法執行此操作，請重新整理' using errcode='22023';
  end if;
end $$;
revoke all on function public.transition_market_order(uuid,text) from public, anon;
grant execute on function public.transition_market_order(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
