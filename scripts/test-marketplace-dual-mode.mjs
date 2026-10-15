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
const buyer = randomUUID(),
  seller = randomUUID(),
  other = randomUUID();
await db.query('insert into auth.users values ($1),($2),($3)', [
  buyer,
  seller,
  other,
]);
let checks = 0;
async function as(user, fn) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}
async function product() {
  const id = randomUUID();
  await as(seller, () =>
    db.query(
      "insert into public.listings(id,seller_id,title,price,image_path,location,condition,allow_meetup,allow_shipping,shipping_note,shipping_fee) values($1,$2,'測試商品',300,'photo.jpg','台北','正常使用',true,true,'自行安排貨到付款',60)",
      [id, seller],
    ),
  );
  return id;
}
async function request(
  id,
  method = 'meetup',
  user = buyer,
  batch = randomUUID(),
) {
  return as(user, async () => {
    const r = await db.query(
      'select public.create_market_requests($1,$2,$3) ids',
      [
        batch,
        JSON.stringify([{ id, method, version: 1 }]),
        JSON.stringify({
          name: '測試',
          phone: '0900000000',
          address: '測試地址',
        }),
      ],
    );
    return r.rows[0].ids[0];
  });
}
async function order(id) {
  return (await db.query('select * from public.orders where id=$1', [id]))
    .rows[0];
}
async function action(id, user, a, payload = {}) {
  const o = await order(id);
  return as(user, () =>
    db.query('select public.market_order_action($1,$2,$3,$4)', [
      id,
      a,
      o.version,
      JSON.stringify(payload),
    ]),
  );
}
async function rejects(fn) {
  await assert.rejects(fn);
  checks++;
}
const p = await product(),
  batch = randomUUID(),
  o = await request(p, 'meetup', buyer, batch);
assert.equal(await request(p, 'meetup', buyer, batch), o);
checks++;
assert.equal(
  (await db.query('select status from public.listings where id=$1', [p]))
    .rows[0].status,
  'active',
);
checks++;
const rival = await request(p, 'meetup', other);
await rejects(() => action(o, buyer, 'accept'));
await action(o, seller, 'accept');
assert.equal((await order(rival)).status, 'rejected');
checks++;
await rejects(() => action(rival, seller, 'accept'));
await rejects(() => request(p));
await rejects(() =>
  as(seller, () =>
    db
      .query(
        "update public.listings set status='active' where id=$1 returning id",
        [p],
      )
      .then(r => {
        if (!r.rows.length) throw new Error('RLS denied');
      }),
  ),
);
await rejects(() => action(o, buyer, 'handover'));
await action(o, seller, 'propose_meetup', {
  starts_at: new Date(Date.now() + 86400000).toISOString(),
  place: '測試公開地點',
});
await rejects(() =>
  action(o, buyer, 'confirm_meetup', { proposal_version: 99 }),
);
await action(o, buyer, 'confirm_meetup', { proposal_version: 1 });
await action(o, seller, 'handover');
assert.equal((await order(o)).status, 'fulfilling');
checks++;
await rejects(() => action(o, buyer, 'request_cancel'));
await action(o, buyer, 'handover');
assert.equal((await order(o)).status, 'completed');
checks++;
const ps = await product(),
  os = await request(ps, 'shipping');
await action(os, seller, 'accept');
await rejects(() => action(os, buyer, 'receive'));
await rejects(() =>
  action(os, buyer, 'ship', { dispatched_at: new Date().toISOString() }),
);
await action(os, seller, 'ship', {
  dispatched_at: new Date().toISOString(),
  carrier: '測試自寄',
});
assert.equal((await order(os)).status, 'fulfilling');
checks++;
await rejects(() => action(os, buyer, 'request_cancel'));
await action(os, buyer, 'receive');
assert.equal((await order(os)).status, 'completed');
checks++;
const pc = await product(),
  oc = await request(pc);
await action(oc, seller, 'accept');
await action(oc, buyer, 'request_cancel');
await rejects(() => action(oc, seller, 'ship'));
await action(oc, seller, 'agree_cancel');
assert.equal((await order(oc)).status, 'cancelled');
assert.equal(
  (await db.query('select status from public.listings where id=$1', [pc]))
    .rows[0].status,
  'active',
);
checks++;
const pi = await product(),
  oi = await request(pi);
await action(oi, seller, 'accept');
await action(oi, buyer, 'open_issue', { details: '測試協調' });
await rejects(() => action(oi, buyer, 'request_cancel'));
const issue = (
  await db.query('select id from public.order_issues where order_id=$1', [oi])
).rows[0].id;
await action(oi, buyer, 'resolve_issue', { issue_id: issue });
assert.equal(
  (
    await db.query('select resolved_at from public.order_issues where id=$1', [
      issue,
    ])
  ).rows[0].resolved_at,
  null,
);
checks++;
await action(oi, seller, 'resolve_issue', { issue_id: issue });
checks++;
await as(other, async () => {
  assert.equal(
    (await db.query('select * from public.orders where id=$1', [oi])).rows
      .length,
    0,
  );
  assert.equal(
    (await db.query('select * from public.order_issues where id=$1', [issue]))
      .rows.length,
    0,
  );
  checks += 2;
});
await rejects(() => action(oi, other, 'accept'));
await as(buyer, async () => {
  const r = await db.query('select version from public.orders where id=$1', [
    oi,
  ]);
  await rejects(() =>
    db.query("select public.market_order_action($1,'request_cancel',$2,'{}')", [
      oi,
      r.rows[0].version - 1,
    ]),
  );
});

const pr = await product(),
  retryBatch = randomUUID();
await request(pr, 'meetup', buyer, retryBatch);
await rejects(() => request(pr, 'shipping', buyer, retryBatch));
const fingerprint = (
  await db.query(
    'select request_payload from public.orders where checkout_batch_id=$1',
    [retryBatch],
  )
).rows[0].request_payload;
assert.equal(JSON.stringify(fingerprint).includes('測試地址'), false);
checks++;
await rejects(() =>
  as(buyer, () =>
    db.query("select public.create_market_requests($1,$2,'{}')", [
      randomUUID(),
      JSON.stringify([{ id: pr, method: 'shipping', version: 1 }]),
    ]),
  ),
);
const cancelPending = await request(pr);
await action(cancelPending, buyer, 'cancel');
assert.equal((await order(cancelPending)).status, 'cancelled');
checks++;
await as(buyer, async () => {
  const cid = (
    await db.query('select public.market_order_conversation($1,$2) id', [
      oi,
      pi,
    ])
  ).rows[0].id;
  assert.ok(cid);
  checks++;
});
await rejects(() =>
  as(other, () =>
    db.query('select public.market_order_conversation($1,$2)', [oi, pi]),
  ),
);
await rejects(() =>
  as(buyer, () =>
    db.query('select public.create_orders_from_cart($1,$2,$3,$4)', [
      [pr],
      '測試',
      '電話',
      '地址',
    ]),
  ),
);
await db.exec('set role anon');
await rejects(() =>
  db.query("select public.market_order_action($1,'accept',1,'{}')", [oi]),
);
await db.exec('reset role');
await db.exec(await fs.readFile('supabase/marketplace-dual-mode.sql', 'utf8'));
checks++;
if (process.argv.includes('--handover-flow')) {
  await db.exec(
    await fs.readFile('supabase/marketplace-handover-flow.sql', 'utf8'),
  );
  const revisedProduct = await product();
  const revisedOrder = await request(revisedProduct);
  await action(revisedOrder, seller, 'accept');
  await rejects(() => action(revisedOrder, buyer, 'handover'));
  await rejects(() => action(revisedOrder, seller, 'propose_meetup'));
  await action(revisedOrder, seller, 'handover');
  assert.equal((await order(revisedOrder)).status, 'fulfilling');
  checks++;
  await rejects(() => action(revisedOrder, seller, 'handover'));
  await action(revisedOrder, buyer, 'handover');
  assert.equal((await order(revisedOrder)).status, 'completed');
  checks++;
  await db.exec(
    await fs.readFile('supabase/marketplace-handover-flow.sql', 'utf8'),
  );
  checks++;
}
if (process.argv.includes('--delivery-channels')) {
  await db.exec(
    await fs.readFile('supabase/marketplace-delivery-channels.sql', 'utf8'),
  );
  const options = [
    { channel: 'meetup', fee: 0, note: '' },
    { channel: 'seven_eleven', fee: 60, note: '' },
    { channel: 'family_mart', fee: 80, note: '' },
    { channel: 'hi_life', fee: 45, note: '' },
    { channel: 'ok_mart', fee: 50, note: '' },
    { channel: 'home_delivery', fee: 120, note: '' },
  ];
  async function listing() {
    const id = await product();
    await as(seller, () =>
      db.query('update public.listings set delivery_options=$1 where id=$2', [
        JSON.stringify(options),
        id,
      ]),
    );
    return id;
  }
  async function channelRequest(
    items,
    recipient = {
      name: '測試',
      phone: '0900000000',
      address: '宅配地址',
      stores: {
        seven_eleven: { name: '測試門市', code: '123', address: '門市地址' },
        family_mart: { name: '全家門市', code: '456', address: '全家地址' },
        hi_life: { name: '萊爾富門市', code: '789', address: '萊爾富地址' },
        ok_mart: { name: 'OK門市', code: '111', address: 'OK地址' },
      },
    },
    batch = randomUUID(),
  ) {
    return as(
      buyer,
      async () =>
        (
          await db.query('select public.create_market_requests($1,$2,$3) ids', [
            batch,
            JSON.stringify(items),
            JSON.stringify(recipient),
          ])
        ).rows[0].ids,
    );
  }
  for (const option of options) {
    const id = await listing();
    const ids = await channelRequest([
      {
        id,
        method: option.channel === 'meetup' ? 'meetup' : 'shipping',
        channel: option.channel,
        version: 2,
      },
    ]);
    const o = await order(ids[0]);
    assert.equal(Number(o.shipping_fee), option.fee);
    checks++;
    if (option.channel !== 'meetup') {
      assert.equal(o.shipping_channel, option.channel);
      checks++;
    }
    if (!['meetup', 'home_delivery'].includes(option.channel)) {
      assert.ok(o.pickup_store.code);
      assert.equal(o.shipping_address, o.pickup_store.address);
      checks++;
    }
  }
  const id = await listing();
  await rejects(() =>
    channelRequest(
      [{ id, method: 'shipping', channel: 'seven_eleven', version: 2 }],
      { name: '測試', phone: '0900000000', address: '不能冒充門市' },
    ),
  );
  await rejects(() =>
    channelRequest([
      { id, method: 'shipping', channel: 'unknown', version: 2 },
    ]),
  );
  await rejects(() =>
    channelRequest([
      { id, method: 'meetup', channel: 'home_delivery', version: 2 },
    ]),
  );
  await rejects(() =>
    as(seller, () =>
      db.query('update public.listings set delivery_options=$1 where id=$2', [
        JSON.stringify([...options, options[0]]),
        id,
      ]),
    ),
  );
  await rejects(() =>
    as(seller, () =>
      db.query('update public.listings set delivery_options=$1 where id=$2', [
        JSON.stringify([{ channel: 'ok_mart', fee: -1 }]),
        id,
      ]),
    ),
  );
  const a = await listing(),
    b = await listing(),
    c = await listing();
  const items = [
    { id: a, method: 'shipping', channel: 'seven_eleven', version: 2 },
    { id: b, method: 'shipping', channel: 'seven_eleven', version: 2 },
    { id: c, method: 'shipping', channel: 'family_mart', version: 2 },
  ];
  const batch = randomUUID();
  const recipient = {
    name: '測試',
    phone: '0900000000',
    address: '',
    stores: {
      seven_eleven: { name: '門市', code: '123', address: '地址' },
      family_mart: { name: '門市二', code: '456', address: '地址二' },
    },
  };
  const ids = await channelRequest(items, recipient, batch);
  assert.equal(ids.length, 2);
  checks++;
  assert.equal(Number((await order(ids[0])).shipping_fee) > 0, true);
  checks++;
  assert.deepEqual(
    new Set(await channelRequest(items, recipient, batch)),
    new Set(ids),
  );
  checks++;
  await rejects(() =>
    channelRequest(items, { ...recipient, name: '不同收件人' }, batch),
  );
  const legacyProduct = await product();
  const legacyOrder = await request(legacyProduct, 'shipping');
  assert.equal(Number((await order(legacyOrder)).shipping_fee), 60);
  checks++;
  const meetProduct = await listing();
  const meetOrder = (
    await channelRequest(
      [{ id: meetProduct, method: 'meetup', channel: 'meetup', version: 2 }],
      {},
    )
  )[0];
  await action(meetOrder, seller, 'accept');
  await action(meetOrder, seller, 'handover');
  await action(meetOrder, buyer, 'handover');
  assert.equal((await order(meetOrder)).status, 'completed');
  checks++;
  // Reapply without resetting market_order_action or losing records.
  await db.exec(
    await fs.readFile('supabase/marketplace-delivery-channels.sql', 'utf8'),
  );
  checks++;
  assert.equal((await order(ids[0])).recipient_name, '測試');
  checks++;
}
console.log(
  `PASS: ${checks} PostgreSQL integration assertions; isolated database only.`,
);
await db.close();
