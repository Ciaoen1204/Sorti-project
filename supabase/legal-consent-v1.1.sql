-- Review and apply ENTIRE file after schema-change approval. Not applied by the app.
-- Run AFTER existing marketplace migrations. Rerun this file after replacing protected RPCs.
begin;
create table if not exists public.legal_acceptances (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 terms_version text not null,
 privacy_version text not null,
 adult_declared boolean not null check(adult_declared),
 accepted_at timestamptz not null default clock_timestamp(),
 unique(user_id,terms_version,privacy_version)
);
alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from public,anon,authenticated;
grant select on public.legal_acceptances to authenticated;
drop policy if exists legal_owner_read on public.legal_acceptances;
create policy legal_owner_read on public.legal_acceptances for select to authenticated using(user_id=(select auth.uid()));
create or replace function public.has_current_legal_acceptance() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.legal_acceptances where user_id=auth.uid() and terms_version='v1.1' and privacy_version='v1.1' and adult_declared);
$$;
create or replace function public.accept_current_policies(p_terms_version text,p_privacy_version text,p_adult boolean,p_agreed boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '請先登入' using errcode='42501'; end if;
 if p_terms_version is distinct from 'v1.1' or p_privacy_version is distinct from 'v1.1' or p_adult is distinct from true or p_agreed is distinct from true then raise exception '請確認目前版本及年齡聲明' using errcode='22023'; end if;
 insert into public.legal_acceptances(user_id,terms_version,privacy_version,adult_declared) values(auth.uid(),'v1.1','v1.1',true) on conflict(user_id,terms_version,privacy_version) do nothing;
end $$;
create or replace function public.assert_current_legal_acceptance() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_current_legal_acceptance() then raise exception '請先完成政策確認' using errcode='42501'; end if;
end $$;
revoke all on function public.has_current_legal_acceptance(),public.accept_current_policies(text,text,boolean,boolean),public.assert_current_legal_acceptance() from public,anon;
grant execute on function public.has_current_legal_acceptance(),public.accept_current_policies(text,text,boolean,boolean),public.assert_current_legal_acceptance() to authenticated;
-- Restrictive policies compose with, rather than replace, existing owner/participant rules.
do $$ declare t text; begin
 foreach t in array array['profiles','user_personas','check_ins','ai_analyses','items','listings','cart_items','orders','order_items','conversations','messages','ai_chat_messages','order_events','market_notifications','push_devices','notification_preferences','notification_deliveries'] loop
  if to_regclass('public.'||t) is not null then
   execute format('alter table public.%I enable row level security',t);
   execute format('drop policy if exists legal_service_gate on public.%I',t);
   execute format('create policy legal_service_gate on public.%I as restrictive for all to authenticated using ((select public.has_current_legal_acceptance())) with check ((select public.has_current_legal_acceptance()))',t);
  end if;
 end loop;
end $$;
drop policy if exists legal_service_gate on storage.objects;
create policy legal_service_gate on storage.objects as restrictive for all to authenticated using((select public.has_current_legal_acceptance())) with check((select public.has_current_legal_acceptance()));
-- SECURITY DEFINER marketplace commands bypass table RLS: guard their entry points too.
-- Abort transaction on an unexpected language/body rather than silently leave a bypass.
do $$ declare f record; definition text; begin
 for f in select p.oid,p.proname,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.proname=any(array['create_market_requests','market_order_action','market_order_conversation','create_orders_from_cart','transition_market_order']) loop
  if f.lanname<>'plpgsql' then raise exception 'Review legal guard for unexpected RPC language: %',f.proname; end if;
  definition:=pg_get_functiondef(f.oid);
  if position('perform public.assert_current_legal_acceptance();' in lower(definition))=0 then
   if definition !~* '\mbegin\M' then raise exception 'Missing RPC body: %',f.proname; end if;
   definition:=regexp_replace(definition,'\mbegin\M','BEGIN PERFORM public.assert_current_legal_acceptance();','i');
   execute definition;
  end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
