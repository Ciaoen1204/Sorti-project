-- Uses only a Vault reference; never put credentials in this migration.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'sorti-market-push-every-minute',
  '* * * * *',
  $schedule$
  select net.http_post(
    url := 'https://riqpljtpfcwuejvoyfoh.supabase.co/functions/v1/market-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'sorti_market_push_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (
    select 1 from public.market_notifications
    where push_state = 'pending' and attempts < 8
      and next_attempt_at <= now()
      and (locked_until is null or locked_until < now())
  ) and exists (select 1 from vault.secrets where name = 'sorti_market_push_secret');
  $schedule$
);
