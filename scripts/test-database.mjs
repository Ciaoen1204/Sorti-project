// In-memory PostgreSQL tests; never connects to the real Supabase project.
// Install test tool: npm install --prefix .pwa-tools/db-test --no-package-lock @electric-sql/pglite
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '../.pwa-tools/db-test/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const charlie = '33333333-3333-4333-8333-333333333333';
const productA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const productB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let checks = 0;
async function asUser(user) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec('set role authenticated');
}
async function rows(sql, params = []) {
  return (await db.query(sql, params)).rows;
}
async function denied(sql, params = []) {
  await assert.rejects(db.query(sql, params));
}
function passed(label) {
  checks++;
  console.log(`OK ${checks}: ${label}`);
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null);
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1] $$;
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
    -- Deliberately broad legacy policies must be constrained by new guards.
    create policy legacy_storage on storage.objects for all to authenticated using (true) with check (true);
    create table public.profiles (id uuid primary key references auth.users(id), username text, display_name text, updated_at timestamptz default now());
    alter table public.profiles enable row level security;
    create policy legacy_profiles on public.profiles for all to authenticated using (true) with check (true);
    insert into auth.users values ('${alice}'), ('${bob}'), ('${charlie}');
    insert into public.profiles(id, username) values ('${alice}', 'preserved-user');
  `);
  const migration = await fs.readFile(new URL('../supabase/setup-all.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  const workflow=await fs.readFile(new URL('../supabase/marketplace-workflow.sql',import.meta.url),'utf8');
  await db.exec(workflow);
  await db.exec(workflow);
  assert.equal((await rows('select username from public.profiles where id = $1', [alice]))[0].username, 'preserved-user');
  assert.equal((await rows("select count(*)::int as n from pg_tables where schemaname = 'public' and rowsecurity"))[0].n, 12);
  passed('Complete migration executes twice, retains existing profile, enables RLS on all 12 tables');

  await asUser(alice);
  await db.query(`insert into public.user_personas(user_id,persona_name,visual_preference,detail_preference,visual_score,detail_score)
    values ($1,'遮醜結界師','minimal','simple',3,2)
    on conflict(user_id) do update set visual_score = excluded.visual_score`, [alice]);
  await db.query(`insert into public.check_ins(user_id,check_in_date,photo_path)
    values ($1,(now() at time zone 'Asia/Taipei')::date,$2)
    on conflict(user_id,check_in_date) do update set photo_path = excluded.photo_path`, [alice, `${alice}/today.jpg`]);
  await denied(`insert into public.check_ins(user_id,check_in_date,photo_path) values ($1,(now() at time zone 'Asia/Taipei')::date+1,'future.jpg')`, [alice]);
  await denied(`insert into public.check_ins(user_id,check_in_date,photo_path) values ($1,(now() at time zone 'Asia/Taipei')::date-1,'past.jpg')`, [alice]);
  await db.query(`insert into public.ai_chat_messages(user_id,role,content,detected_items) values ($1,'assistant','你好','[]')`, [alice]);
  const analysis = (await rows(`insert into public.ai_analyses(user_id,photo_path,total_detections,summary,advice_text,status)
    values ($1,'',1,'summary','advice','completed') returning id`, [alice]))[0].id;
  await db.query(`insert into public.items(user_id,analysis_id,name,category,quantity,source) values ($1,$2,'書','書籍',1,'ai')`, [alice, analysis]);
  passed('Persona upsert, today-only check-in, analysis, items and AI messages work');

  await asUser(bob);
  for (const table of ['profiles', 'user_personas', 'check_ins', 'ai_analyses', 'items', 'ai_chat_messages']) {
    assert.equal((await rows(`select * from public.${table}`)).length, 0);
  }
  await denied(`insert into public.ai_chat_messages(user_id,role,content) values ($1,'user','forged')`, [alice]);
  await denied(`insert into public.items(user_id,analysis_id,name) values ($1,$2,'stolen analysis')`, [bob, analysis]);
  passed('Other user cannot read private records, impersonate owner or link someone else’s analysis');

  await asUser(alice);
  await db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['check-in-photos', `${alice}/photo.jpg`]);
  await denied('insert into storage.objects(bucket_id,name) values ($1,$2)', ['analysis-photos', `${bob}/forged.jpg`]);
  await asUser(bob);
  assert.equal((await rows('select * from storage.objects')).length, 0);
  passed('Storage privacy holds even with a broad pre-existing policy');

  await db.query(`insert into public.listings(id,seller_id,title,price,image_path,status)
    values ($1,$2,'商品 A',400,'photo-a.jpg','active')`, [productA, bob]);
  await denied(`insert into public.listings(seller_id,title,price,image_path) values ($1,'偽造商品',1,'x')`, [alice]);
  await asUser(alice);
  assert.equal((await rows('select * from public.listings')).length, 1);
  assert.equal((await rows("update public.listings set price=1 where id=$1 returning id", [productA])).length, 0);
  passed('Market supports browsing while protecting seller ownership and prices');

  const conversation = (await rows(`insert into public.conversations(listing_id,buyer_id,seller_id)
    values ($1,$2,$3) on conflict(listing_id,buyer_id,seller_id)
    do update set seller_id=excluded.seller_id returning id`, [productA, alice, bob]))[0].id;
  await denied(`insert into public.conversations(listing_id,buyer_id,seller_id) values ($1,$2,$3)`, [productA, alice, charlie]);
  await denied(`update public.conversations set seller_id=$1 where id=$2`, [charlie, conversation]);
  await db.query(`insert into public.messages(conversation_id,sender_id,content,message_type) values ($1,$2,'buyer message','text')`, [conversation, alice]);
  await denied(`insert into public.messages(conversation_id,sender_id,content) values ($1,$2,'forged')`, [conversation, bob]);
  await asUser(bob);
  await db.query(`insert into public.messages(conversation_id,sender_id,content) values ($1,$2,'seller reply')`, [conversation, bob]);
  assert.equal((await rows('update public.conversations set last_message_at=now() where id=$1 returning id', [conversation])).length, 1);
  assert.equal((await rows('select * from public.messages')).length, 2);
  await asUser(charlie);
  assert.equal((await rows('select * from public.conversations')).length, 0);
  assert.equal((await rows('select * from public.messages')).length, 0);
  await denied(`insert into public.messages(conversation_id,sender_id,content) values ($1,$2,'intruder')`, [conversation, charlie]);
  passed('Conversation upsert, seller reply, participant identity and outsider privacy work');

  await db.query(`insert into public.listings(id,seller_id,title,price,image_path) values ($1,$2,'商品 B',600,'photo-b.jpg')`, [productB, charlie]);
  await asUser(alice);
  for (const id of [productA, productB]) {
    await db.query('insert into public.cart_items(user_id,listing_id) values ($1,$2) on conflict(user_id,listing_id) do nothing', [alice, id]);
  }
  await denied(`insert into public.orders(buyer_id,seller_id,recipient_name,recipient_phone,shipping_address,payment_method,subtotal,shipping_fee,total_amount,status)
    values ($1,$2,'fake','123','address','magic_coin',1,0,1,'paid')`, [alice, bob]);
  const result = (await rows('select public.create_orders_from_cart($1::uuid[],$2,$3,$4) as ids', [[productA, productB], '測試收件人', '0912345678', '測試地址']))[0].ids;
  assert.equal(result.length, 2);
  const orders = await rows('select * from public.orders order by subtotal');
  assert.deepEqual(orders.map(o => Number(o.total_amount)), [460, 600]);
  assert(orders.every(o => o.status === 'pending' && o.payment_method === 'cod'));
  assert.equal((await rows('select * from public.order_items')).length, 2);
  assert.equal((await rows('select * from public.cart_items')).length, 0);
  await denied('update public.orders set total_amount=1');
  await denied('select public.create_orders_from_cart($1::uuid[],$2,$3,$4)', [[productA], 'n', 'p', 'a']);
  assert.equal((await rows('select * from public.orders')).length, 2);
  passed('Atomic multi-seller checkout uses true prices, shipping, snapshots; blocks forged payment and duplicate purchase');

  await asUser(bob);
  assert.equal((await rows('select * from public.orders')).length, 1);
  assert.equal((await rows('select * from public.order_items')).length, 1);
  await asUser(charlie);
  assert.equal((await rows('select * from public.orders')).length, 1);
  assert.equal((await rows('select * from public.order_items')).length, 1);
  passed('Sellers only see their own order and recipient details');

  const bobOrder=orders.find(o=>o.seller_id===bob).id;
  const charlieOrder=orders.find(o=>o.seller_id===charlie).id;
  await asUser(alice);
  await denied('select public.transition_market_order($1,$2)',[bobOrder,'ship']);
  await denied('select public.transition_market_order($1,$2)',[bobOrder,'complete']);
  assert.equal((await rows('select l.id from public.order_items i join public.listings l on l.id=i.listing_id')).length,2);
  await asUser(charlie);
  await denied('select public.transition_market_order($1,$2)',[bobOrder,'cancel']);
  await asUser(bob);
  assert.equal((await rows("update public.listings set status='active' where id=$1 returning id",[productA])).length,0);
  await db.query('select public.transition_market_order($1,$2)',[bobOrder,'ship']);
  await asUser(alice);
  await denied('select public.transition_market_order($1,$2)',[bobOrder,'cancel']);
  await db.query('select public.transition_market_order($1,$2)',[bobOrder,'complete']);
  assert.equal((await rows('select status from public.orders where id=$1',[bobOrder]))[0].status,'completed');
  await db.query('select public.transition_market_order($1,$2)',[charlieOrder,'cancel']);
  assert.equal((await rows('select status from public.listings where id=$1',[productB]))[0].status,'active');
  await denied('select public.transition_market_order($1,$2)',[charlieOrder,'ship']);
  passed('Buyer/seller actions enforce shipment, receipt, cancellation, restocking and sold-item protection');

  await asUser(bob);
  const managed=(await rows(`insert into public.listings(seller_id,title,price,image_path) values ($1,'Manage test',30,'manage.jpg') returning id`,[bob]))[0].id;
  await denied('insert into public.cart_items(user_id,listing_id) values ($1,$2)',[bob,managed]);
  await db.query("update public.listings set status='archived',price=40 where id=$1",[managed]);
  await asUser(alice);
  assert.equal((await rows('select * from public.listings where id=$1',[managed])).length,0);
  await denied('insert into public.cart_items(user_id,listing_id) values ($1,$2)',[alice,managed]);
  await asUser(bob);
  await db.query("update public.listings set status='active' where id=$1",[managed]);
  passed('Seller can edit/archive/relist; buyers cannot purchase archived items or their own listing');

  await db.exec('reset role');
  const rollbackProduct = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  await db.query(`insert into public.listings(id,seller_id,title,price,image_path)
    values ($1,$2,'Rollback test',100,'rollback.jpg')`, [rollbackProduct, bob]);
  await db.exec(`
    create function public.test_fail_order_item() returns trigger language plpgsql as
      $$ begin raise exception 'Simulated snapshot failure'; end $$;
    create trigger test_fail_order_item before insert on public.order_items
      for each row execute function public.test_fail_order_item();
  `);
  await asUser(alice);
  await db.query('insert into public.cart_items(user_id,listing_id) values ($1,$2)', [alice, rollbackProduct]);
  await denied('select public.create_orders_from_cart($1::uuid[],$2,$3,$4)', [[rollbackProduct], 'n', 'p', 'a']);
  assert.equal((await rows('select * from public.orders')).length, 2);
  assert.equal((await rows('select * from public.cart_items')).length, 1);
  assert.equal((await rows('select status from public.listings where id=$1', [rollbackProduct]))[0].status, 'active');
  await db.exec('reset role; drop trigger test_fail_order_item on public.order_items; drop function public.test_fail_order_item();');
  passed('Failure after order insertion rolls back the order and keeps cart/listing unchanged');

  await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;");
  await denied('select * from public.profiles');
  await denied('select * from public.check_ins');
  await denied('select public.create_orders_from_cart($1::uuid[],$2,$3,$4)', [[productA], 'n', 'p', 'a']);
  passed('Anonymous users cannot access private tables or execute checkout');
  console.log(`${checks} database checks passed (local PostgreSQL with simulated Supabase auth/storage).`);
} finally {
  await db.close();
}
