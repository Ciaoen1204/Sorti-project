// Isolated PostgreSQL-compatible integration test; never connects to Supabase.
import { PGlite } from '../.local-tools/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
for (const file of [
  'supabase/setup-all.sql',
  'supabase/marketplace-workflow.sql',
  'supabase/marketplace-dual-mode.sql',
])
  await db.exec(await fs.readFile(file, 'utf8'));

await db.exec(await fs.readFile('supabase/marketplace-notifications.sql','utf8'));
// Verify repeatability.
await db.exec(await fs.readFile('supabase/marketplace-notifications.sql','utf8'));
const buyer=randomUUID(), seller=randomUUID(), outsider=randomUUID(),listing=randomUUID(),conversation=randomUUID(),order=randomUUID();
await db.query('insert into auth.users values ($1),($2),($3)',[buyer,seller,outsider]);
await db.query("insert into public.listings(id,seller_id,title,price,image_path,location,condition,allow_meetup,allow_shipping) values($1,$2,'chair',100,'photo','Taipei','正常使用',true,false)",[listing,seller]);
await db.query('insert into public.conversations(id,listing_id,buyer_id,seller_id) values($1,$2,$3,$4)',[conversation,listing,buyer,seller]);
await db.query("insert into public.messages(conversation_id,sender_id,content) values($1,$2,'hello')",[conversation,buyer]);
assert.equal((await db.query('select user_id from public.market_notifications')).rows[0].user_id,seller);
await db.query("insert into public.orders(id,buyer_id,seller_id,payment_method,subtotal,shipping_fee,total_amount,status,workflow_version,delivery_method) values($1,$2,$3,'cod',100,0,100,'requested',2,'meetup')",[order,buyer,seller]);
await db.query("insert into public.order_events(order_id,actor_id,event_type) values($1,$2,'requested')",[order,buyer]);
await db.query("insert into public.order_events(order_id,actor_id,event_type) values($1,$2,'accept')",[order,seller]);
assert.equal((await db.query('select count(*)::int n from public.market_notifications')).rows[0].n,3);
async function as(user,fn){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');try{await fn();}finally{await db.exec('reset role');}}
await as(outsider,async()=>assert.equal((await db.query('select * from public.market_notifications')).rows.length,0));
await as(buyer,async()=>{
 assert.equal((await db.query('select * from public.market_notifications')).rows.length,1);
 await db.query('update public.market_notifications set read_at=now()');
 await assert.rejects(()=>db.query("update public.market_notifications set body='forged'"));
 await assert.rejects(()=>db.query("insert into public.market_notifications(user_id,event_key,kind,title,body,target) values($1,'fake','chat','fake','fake','{}')",[seller]));
 await db.query('insert into public.notification_preferences(user_id,chat) values($1,false)',[buyer]);
 await db.query("insert into public.push_devices(token,user_id,platform) values('device',$1,'android')",[buyer]);
 await assert.rejects(()=>db.query('select * from public.claim_market_notification_push()'));
});
await as(outsider,async()=>{
 assert.equal((await db.query('select * from public.push_devices')).rows.length,0);
 await assert.rejects(()=>db.query("insert into public.push_devices(token,user_id,platform) values('device',$1,'android') on conflict(token) do update set user_id=excluded.user_id",[outsider]));
});
await db.exec('set role service_role');
assert.equal((await db.query('select * from public.claim_market_notification_push()')).rows.length,3);
assert.equal((await db.query('select * from public.claim_market_notification_push()')).rows.length,0);
await db.exec('reset role');
console.log('Notifications: routing, no self-notification, RLS, read-only fields, token ownership, worker permissions and claim lease passed.');
await db.close();
