-- Verify with a real existing identity inside a rolled-back transaction. No consent persists.
begin;
do $$ declare actor uuid; first_time timestamptz; begin
 select id into actor from auth.users order by created_at limit 1;
 if actor is null then raise exception 'No test identity available';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin
  perform public.accept_current_policies('v1.0','v1.1',true,true);
  raise exception 'Old version incorrectly accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.accept_current_policies('v1.1','v1.1',false,true);
  raise exception 'Age declaration incorrectly accepted';
 exception when invalid_parameter_value then null;end;
 perform public.accept_current_policies('v1.1','v1.1',true,true);
 if not public.has_current_legal_acceptance() then raise exception 'Acceptance unreadable';end if;
 select accepted_at into first_time from public.legal_acceptances where user_id=actor and terms_version='v1.1' and privacy_version='v1.1';
 perform public.accept_current_policies('v1.1','v1.1',true,true);
 if first_time is distinct from (select accepted_at from public.legal_acceptances where user_id=actor and terms_version='v1.1' and privacy_version='v1.1') then raise exception 'Timestamp overwritten';end if;
 perform set_config('request.jwt.claim.sub','',true);
 if public.has_current_legal_acceptance() then raise exception 'Anonymous accepted';end if;
end $$;
select 'PASS: server versions, age, save/read, idempotency, anonymous denial; transaction rolled back' as verification;
rollback;
