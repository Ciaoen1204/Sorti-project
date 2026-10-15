-- SORTI full database setup. Run the ENTIRE file in Supabase SQL Editor.
-- Non-destructive: no table/record deletion. Compatible existing tables are retained.
-- Incompatible existing definitions cause a transaction rollback; do not drop them.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_personas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  persona_name text not null,
  visual_preference text not null check (visual_preference in ('rich', 'minimal')),
  detail_preference text not null check (detail_preference in ('simple', 'detailed')),
  visual_score integer not null,
  detail_score integer not null,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  check_in_date date not null,
  photo_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, check_in_date)
);

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_path text not null default '',
  total_detections integer not null default 0 check (total_detections >= 0),
  summary text not null default '',
  advice_text text not null default '',
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid,
  name text not null check (length(btrim(name)) > 0),
  category text not null default '未分類',
  quantity integer not null default 1 check (quantity >= 1),
  source text not null default 'manual' check (source in ('ai', 'manual')),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_analysis_id_fkey foreign key (analysis_id)
    references public.ai_analyses(id) on delete cascade
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  category text not null default '其他',
  price numeric(12,2) not null check (price >= 0),
  location text not null default '',
  image_path text not null,
  status text not null default 'active' check (status in ('active', 'sold', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id),
  seller_id uuid not null references auth.users(id),
  recipient_name text not null check (length(btrim(recipient_name)) > 0),
  recipient_phone text not null check (length(btrim(recipient_phone)) > 0),
  shipping_address text not null check (length(btrim(shipping_address)) > 0),
  payment_method text not null default 'cod' check (payment_method in ('cod', 'magic_coin')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping_fee numeric(12,2) not null check (shipping_fee >= 0),
  total_amount numeric(12,2) not null check (total_amount = subtotal + shipping_fee),
  status text not null default 'pending' check (status in ('pending', 'paid', 'shipped', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  listing_id uuid not null references public.listings(id),
  title_snapshot text not null,
  price_snapshot numeric(12,2) not null check (price_snapshot >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, listing_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id, seller_id),
  check (buyer_id <> seller_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(btrim(content)) between 1 and 10000),
  message_type text not null default 'text' check (message_type = 'text'),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  detected_items jsonb not null default '[]'::jsonb check (jsonb_typeof(detected_items) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists sorti_analyses_user_created on public.ai_analyses (user_id, created_at desc);
create index if not exists sorti_items_user on public.items (user_id);
create index if not exists sorti_items_analysis on public.items (analysis_id);
create index if not exists sorti_listings_status_created on public.listings (status, created_at desc);
create index if not exists sorti_listings_seller on public.listings (seller_id);
create index if not exists sorti_cart_listing on public.cart_items (listing_id);
create index if not exists sorti_orders_buyer_created on public.orders (buyer_id, created_at desc);
create index if not exists sorti_orders_seller_created on public.orders (seller_id, created_at desc);
create index if not exists sorti_order_items_listing on public.order_items (listing_id);
create index if not exists sorti_conversations_buyer on public.conversations (buyer_id);
create index if not exists sorti_conversations_seller on public.conversations (seller_id);
create index if not exists sorti_messages_conversation_created on public.messages (conversation_id, created_at);
create index if not exists sorti_ai_chat_user_created on public.ai_chat_messages (user_id, created_at);

-- Only reset our namespaced policies. Restrictive guards also constrain legacy policies.
-- Grants are explicit: no anonymous table access, no client order/payment mutation.
do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array[
    'profiles', 'user_personas', 'check_ins', 'ai_analyses', 'items', 'listings',
    'cart_items', 'orders', 'order_items', 'conversations', 'messages', 'ai_chat_messages'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    for policy_row in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = table_name
        and left(policyname, 6) = 'sorti_'
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, table_name);
    end loop;
  end loop;

  foreach table_name in array array['user_personas', 'check_ins', 'ai_analyses', 'items', 'cart_items', 'ai_chat_messages'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy sorti_owner on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', table_name);
    execute format('create policy sorti_owner_guard on public.%I as restrictive for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', table_name);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
create policy sorti_profile_owner on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy sorti_profile_guard on public.profiles as restrictive for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Date is enforced at the database as well as in the App (Taipei timezone).
create policy sorti_check_in_today_insert on public.check_ins as restrictive for insert to authenticated
  with check (check_in_date = (now() at time zone 'Asia/Taipei')::date);
create policy sorti_check_in_today_update on public.check_ins as restrictive for update to authenticated
  using (check_in_date = (now() at time zone 'Asia/Taipei')::date)
  with check (check_in_date = (now() at time zone 'Asia/Taipei')::date);
create policy sorti_item_analysis_owner on public.items as restrictive for all to authenticated
  using (analysis_id is null or exists (select 1 from public.ai_analyses a where a.id = analysis_id and a.user_id = (select auth.uid())))
  with check (analysis_id is null or exists (select 1 from public.ai_analyses a where a.id = analysis_id and a.user_id = (select auth.uid())));

grant select, insert, update, delete on public.listings to authenticated;
create policy sorti_listing_read on public.listings for select to authenticated
  using (status = 'active' or seller_id = (select auth.uid()));
create policy sorti_listing_read_guard on public.listings as restrictive for select to authenticated
  using (status = 'active' or seller_id = (select auth.uid()));
create policy sorti_listing_insert on public.listings for insert to authenticated
  with check (seller_id = (select auth.uid()));
create policy sorti_listing_insert_guard on public.listings as restrictive for insert to authenticated
  with check (seller_id = (select auth.uid()));
create policy sorti_listing_update on public.listings for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
create policy sorti_listing_update_guard on public.listings as restrictive for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
create policy sorti_listing_delete on public.listings for delete to authenticated
  using (seller_id = (select auth.uid()));
create policy sorti_listing_delete_guard on public.listings as restrictive for delete to authenticated
  using (seller_id = (select auth.uid()));

grant select on public.orders, public.order_items to authenticated;
create policy sorti_order_read on public.orders for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));
create policy sorti_order_read_guard on public.orders as restrictive for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));
create policy sorti_order_item_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (select auth.uid()) in (o.buyer_id, o.seller_id)));
create policy sorti_order_item_read_guard on public.order_items as restrictive for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (select auth.uid()) in (o.buyer_id, o.seller_id)));

-- The client upserts identical participants; an identity trigger prevents changes.
grant select, insert, update on public.conversations to authenticated;
create policy sorti_conversation_read_guard on public.conversations as restrictive for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));
create policy sorti_conversation_insert_guard on public.conversations as restrictive for insert to authenticated
  with check (buyer_id = (select auth.uid()) and buyer_id <> seller_id
    and exists (select 1 from public.listings l where l.id = conversations.listing_id and l.seller_id = conversations.seller_id));
create policy sorti_conversation_update_guard on public.conversations as restrictive for update to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id))
  with check ((select auth.uid()) in (buyer_id, seller_id));

create or replace function public.sorti_keep_conversation_participants()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.id, new.listing_id, new.buyer_id, new.seller_id)
    is distinct from (old.id, old.listing_id, old.buyer_id, old.seller_id) then
    raise exception 'Conversation participants cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create or replace trigger sorti_conversation_identity
  before update on public.conversations for each row
  execute function public.sorti_keep_conversation_participants();

-- UPDATE allows both participants to bump last_message_at.
create policy sorti_conversation_read on public.conversations for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));
create policy sorti_conversation_insert on public.conversations for insert to authenticated
  with check (buyer_id = (select auth.uid()) and buyer_id <> seller_id
    and exists (select 1 from public.listings l where l.id = conversations.listing_id and l.seller_id = conversations.seller_id));
create policy sorti_conversation_update on public.conversations for update to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id))
  with check ((select auth.uid()) in (buyer_id, seller_id));

grant select, insert on public.messages to authenticated;
create policy sorti_message_read on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and (select auth.uid()) in (c.buyer_id, c.seller_id)));
create policy sorti_message_read_guard on public.messages as restrictive for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and (select auth.uid()) in (c.buyer_id, c.seller_id)));
create policy sorti_message_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and exists (select 1 from public.conversations c where c.id = conversation_id and (select auth.uid()) in (c.buyer_id, c.seller_id)));
create policy sorti_message_insert_guard on public.messages as restrictive for insert to authenticated
  with check (sender_id = (select auth.uid()) and exists (select 1 from public.conversations c where c.id = conversation_id and (select auth.uid()) in (c.buyer_id, c.seller_id)));

-- Atomic COD checkout: prices, sellers and shipping come from the database.
-- No client permission to INSERT orders, change payment status or write snapshots.
create or replace function public.create_orders_from_cart(
  p_listing_ids uuid[], p_recipient_name text, p_recipient_phone text, p_shipping_address text
) returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  buyer uuid := auth.uid();
  order_id uuid;
  order_ids uuid[] := '{}'::uuid[];
  seller_group record;
  matched_count integer;
  shipping numeric(12,2);
begin
  if buyer is null then raise exception 'Please sign in' using errcode = '42501'; end if;
  if coalesce(cardinality(p_listing_ids), 0) = 0 or cardinality(p_listing_ids) > 100
    or cardinality(p_listing_ids) <> (select count(distinct x) from unnest(p_listing_ids) x) then
    raise exception 'Invalid cart selection' using errcode = '22023';
  end if;
  if coalesce(length(btrim(p_recipient_name)), 0) = 0
    or coalesce(length(btrim(p_recipient_phone)), 0) = 0
    or coalesce(length(btrim(p_shipping_address)), 0) = 0 then
    raise exception 'Recipient details are required' using errcode = '22023';
  end if;

  -- Lock in stable order so simultaneous checkout cannot buy the same item.
  perform l.id from public.listings l
    where l.id = any(p_listing_ids) order by l.id for update;
  perform c.id from public.cart_items c
    where c.user_id = buyer and c.listing_id = any(p_listing_ids) order by c.id for update;
  select count(*) into matched_count
    from public.cart_items c join public.listings l on l.id = c.listing_id
    where c.user_id = buyer and l.id = any(p_listing_ids)
      and l.status = 'active' and l.seller_id <> buyer;
  if matched_count <> cardinality(p_listing_ids) then
    raise exception 'Cart items are unavailable; refresh the cart' using errcode = '22023';
  end if;

  for seller_group in
    select l.seller_id, sum(l.price) as subtotal
    from public.listings l where l.id = any(p_listing_ids) group by l.seller_id
  loop
    shipping := case when seller_group.subtotal > 500 then 0 else 60 end;
    insert into public.orders (buyer_id, seller_id, recipient_name, recipient_phone,
      shipping_address, payment_method, subtotal, shipping_fee, total_amount, status)
    values (buyer, seller_group.seller_id, btrim(p_recipient_name), btrim(p_recipient_phone),
      btrim(p_shipping_address), 'cod', seller_group.subtotal, shipping,
      seller_group.subtotal + shipping, 'pending') returning id into order_id;
    insert into public.order_items (order_id, listing_id, title_snapshot, price_snapshot)
      select order_id, l.id, l.title, l.price from public.listings l
      where l.id = any(p_listing_ids) and l.seller_id = seller_group.seller_id;
    order_ids := array_append(order_ids, order_id);
  end loop;

  update public.listings set status = 'sold', updated_at = now() where id = any(p_listing_ids);
  delete from public.cart_items where user_id = buyer and listing_id = any(p_listing_ids);
  return order_ids;
end $$;
revoke all on function public.create_orders_from_cart(uuid[], text, text, text) from public, anon;
grant execute on function public.create_orders_from_cart(uuid[], text, text, text) to authenticated;

-- Photo storage: private personal photos, publicly viewable product photos.
insert into storage.buckets (id, name, public) values
  ('check-in-photos', 'check-in-photos', false),
  ('analysis-photos', 'analysis-photos', false),
  ('product-photos', 'product-photos', true)
on conflict (id) do update set public = excluded.public;
drop policy if exists sorti_user_photo_access_v1 on storage.objects;
drop policy if exists sorti_user_photo_guard_v1 on storage.objects;
create policy sorti_user_photo_access_v1 on storage.objects for all to authenticated
  using (bucket_id in ('check-in-photos', 'analysis-photos', 'product-photos') and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id in ('check-in-photos', 'analysis-photos', 'product-photos') and (storage.foldername(name))[1] = (select auth.uid()::text));
-- Restrict SORTI buckets while leaving unrelated bucket policies alone.
create policy sorti_user_photo_guard_v1 on storage.objects as restrictive for all to authenticated
  using (bucket_id not in ('check-in-photos', 'analysis-photos', 'product-photos') or (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id not in ('check-in-photos', 'analysis-photos', 'product-photos') or (storage.foldername(name))[1] = (select auth.uid()::text));

-- BEGIN MARKETPLACE WORKFLOW

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

-- END MARKETPLACE WORKFLOW

notify pgrst, 'reload schema';
commit;

select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in (
  'profiles', 'user_personas', 'check_ins', 'ai_analyses', 'items', 'listings',
  'cart_items', 'orders', 'order_items', 'conversations', 'messages', 'ai_chat_messages'
) order by tablename;
