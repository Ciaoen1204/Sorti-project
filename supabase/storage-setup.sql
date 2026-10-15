-- Run in the SQL Editor of the Supabase project configured in .env.
-- Check-in and analysis photos are private; marketplace photos are public.
begin;

insert into storage.buckets (id, name, public)
values
  ('check-in-photos', 'check-in-photos', false),
  ('analysis-photos', 'analysis-photos', false),
  ('product-photos', 'product-photos', true)
on conflict (id) do update set public = excluded.public;

-- App uploads to <authenticated user ID>/<unique filename>.
-- Existing policies are preserved. This policy only covers these three buckets.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'sorti_user_photo_access_v1'
  ) then
    create policy sorti_user_photo_access_v1
      on storage.objects for all to authenticated
      using (
        bucket_id in ('check-in-photos', 'analysis-photos', 'product-photos')
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      )
      with check (
        bucket_id in ('check-in-photos', 'analysis-photos', 'product-photos')
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );
  end if;
end $$;

commit;

-- Verify all three rows exist with the intended visibility.
select id, public from storage.buckets
where id in ('check-in-photos', 'analysis-photos', 'product-photos')
order by id;
