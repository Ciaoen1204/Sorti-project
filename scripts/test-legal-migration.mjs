// Local PostgreSQL (PGlite) verification only. Never connects to Supabase.
import { PGlite } from '../pwa-runtime/sqltest/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,storage to authenticated;
grant execute on function auth.uid() to authenticated;
create table storage.objects(id uuid primary key);
alter table storage.objects enable row level security;
create table public.items(id uuid primary key,user_id uuid);alter table public.items enable row level security;
grant all on public.items to authenticated;create policy item_owner on public.items to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create function public.market_order_action() returns void language plpgsql security definer as $$begin insert into public.items values(gen_random_uuid(),auth.uid());end$$;
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
await db.exec(
  await readFile(
    new URL('../supabase/legal-consent-v1.1.sql', import.meta.url),
    'utf8',
  ),
);
// Applying the same migration twice must not duplicate guarded RPC code.
await db.exec(
  await readFile(
    new URL('../supabase/legal-consent-v1.1.sql', import.meta.url),
    'utf8',
  ),
);
assert.equal((await db.query("select pg_get_functiondef('public.market_order_action()'::regprocedure) definition")).rows[0].definition.toLowerCase().split('perform public.assert_current_legal_acceptance();').length-1,1);
await db.exec(
  `set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)`,
);
const scalar = async sql => (await db.query(sql)).rows[0];
const rejects = async sql => {
  await assert.rejects(() => db.exec(sql));
};
assert.equal(
  (await scalar('select public.has_current_legal_acceptance() accepted'))
    .accepted,
  false,
);
await rejects('select public.market_order_action()');
await rejects("select public.accept_current_policies('v1.0','v1.1',true,true)");
await rejects(
  "select public.accept_current_policies('v1.1','v1.1',false,true)",
);
await rejects(
  "select public.accept_current_policies('v1.1','v1.1',true,false)",
);
await rejects(
  "insert into public.legal_acceptances(user_id,terms_version,privacy_version,adult_declared) values(auth.uid(),'v1.1','v1.1',true)",
);
await db.exec("select public.accept_current_policies('v1.1','v1.1',true,true)");
const first = await scalar('select * from public.legal_acceptances');
await db.exec("select public.accept_current_policies('v1.1','v1.1',true,true)");
assert.deepEqual(await scalar('select * from public.legal_acceptances'), first);
await rejects('update public.legal_acceptances set accepted_at=now()');
await rejects('delete from public.legal_acceptances');
await db.exec('select public.market_order_action()');
assert.equal((await scalar('select count(*)::int n from public.items')).n, 1);
await db.exec(
  "select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)",
);
assert.equal(
  (await scalar('select count(*)::int n from public.legal_acceptances')).n,
  0,
);
assert.equal((await scalar('select count(*)::int n from public.items')).n, 0);
await rejects('select public.market_order_action()');
await db.exec(
  "reset role;select set_config('request.jwt.claim.sub','',false);set role anon",
);
await rejects('select public.has_current_legal_acceptance()');
await rejects("select public.accept_current_policies('v1.1','v1.1',true,true)");
console.log(
  'PASS: server versions, age/agreement, timestamp immutability, own-only RLS, no direct writes, RPC guard, anonymous denial.',
);
await db.close();
