import { academyResults } from '../../src/data/storagePersonas';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const taipeiDate = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(
    new Date(),
  );
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  email: 'pwa-test@example.com',
  role: 'authenticated',
  user_metadata: {},
  app_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};
const token =
  Buffer.from('{}').toString('base64url') +
  '.' +
  Buffer.from(
    JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url') +
  '.test';

test('retained login survives reload and a newly opened page', async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole('navigation', { name: '主要導覽' })
    .getByRole('button', { name: '首頁', exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '讓整理，從一個角落開始' }),
  ).toBeVisible();
  await expect(page.getByLabel('電子郵件', { exact: true })).toHaveCount(0);
  const reopened = await page.context().newPage();
  await reopened.goto('/');
  await expect(
    reopened.getByRole('heading', { name: '讓整理，從一個角落開始' }),
  ).toBeVisible();
  await reopened.close();
});

test('unconfigured Google login explains setup instead of leaving the page', async ({
  page,
}) => {
  await page.route('**/auth/v1/settings', route =>
    route.fulfill({ json: { external: { google: false } } }),
  );
  await page.goto('/');
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page
    .getByRole('button', { name: '使用 Google 帳號登入', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Google 登入尚未啟用');
  await expect(
    page.getByRole('button', { name: '登入', exact: true }),
  ).toBeEnabled();
});

test('cancelled Google login can return through welcome to password login and Google retry', async ({
  page,
}) => {
  await page.route('**/auth/v1/settings', route =>
    route.fulfill({ json: { external: { google: true } } }),
  );
  await page.route('**/auth/v1/authorize**', route =>
    route.fulfill({
      contentType: 'text/html',
      body: '<h1>Google account selection</h1>',
    }),
  );
  await page.goto('/');
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page
    .getByRole('button', { name: '使用 Google 帳號登入', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Google account selection' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button',{name:'登入',exact:true})).toBeVisible();
  if(await page.getByRole('heading',{name:'讓生活，回到喜歡的樣子'}).isVisible())await page.getByRole('button',{name:'登入',exact:true}).click();
  await expect(
    page.getByRole('button', { name: '登入', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: '使用 Google 帳號登入', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: '使用 Google 帳號登入', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Google account selection' }),
  ).toBeVisible();
});

test('Google PKCE callback returns to the same origin and persists the session', async ({
  page,
}) => {
  const origin = String(test.info().project.use.baseURL);
  let exchange: any;
  await page.context().route(/\/auth\/v1\//, async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/settings'))
      return route.fulfill({ json: { external: { google: true } } });
    if (url.pathname.endsWith('/authorize')) {
      expect(url.searchParams.get('provider')).toBe('google');
      expect(url.searchParams.get('redirect_to')).toBe(
        origin + '/?auth_callback=google',
      );
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      return route.fulfill({
        contentType: 'text/html',
        body:
          '<!doctype html><meta http-equiv="refresh" content="0;url=' +
          origin +
          '/?auth_callback=google&amp;code=google-test-code">',
      });
    }
    if (url.pathname.endsWith('/token')) {
      exchange = route.request().postDataJSON();
      expect(url.searchParams.get('grant_type')).toBe('pkce');
      return route.fulfill({
        json: {
          access_token: token,
          refresh_token: 'google-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          user,
        },
      });
    }
    return route.fulfill({ json: user });
  });
  await page.context().route(/\/rest\/v1\//, route =>
    route.fulfill({
      json: route.request().url().includes('has_current_legal_acceptance')?true:route.request().url().includes('user_personas')
        ? { persona_name: '首席秩序官' }
        : [],
    }),
  );
  await page.goto('/');
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page
    .getByRole('button', { name: '使用 Google 帳號登入', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '讓整理，從一個角落開始' }),
  ).toBeVisible();
  expect(exchange.auth_code).toBe('google-test-code');
  expect(exchange.code_verifier.length).toBeGreaterThan(20);
  await expect(page).toHaveURL(origin + '/#home');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '讓整理，從一個角落開始' }),
  ).toBeVisible();
});

test('phone layout follows Native navigation and retains all menu entry points', async ({
  page,
}, testInfo) => {
  await login(page);
  await page
    .getByRole('navigation', { name: '主要導覽' })
    .getByRole('button', { name: '首頁', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '讓整理，從一個角落開始' }),
  ).toBeVisible();
  await expect(page.locator('nav button')).toHaveText([
    '首頁',
    '物品',
    '二手市集',
    '設定',
  ]);
  await expect(page.getByRole('heading', { name: '今天的小步驟' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '用不到的物品' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /捐贈與回收.*找捐贈單位/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `pwa-runtime/aligned-home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '開啟選單', exact: true }).click();
  const menu = page.getByRole('dialog', { name: '功能選單' });
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole('button', { name: '收納測驗', exact: true }),
  ).toBeVisible();
  await menu.getByRole('button', { name: '捐贈與回收', exact: true }).click();
  await expect(menu).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: '捐贈與回收', exact: true }),
  ).toBeAttached();
  await page.getByRole('button', { name: '開啟選單', exact: true }).click();
  await menu.getByRole('button', { name: '設定', exact: true }).click();
  await page.screenshot({
    path: `pwa-runtime/aligned-settings-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel('深色模式', { exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--bg')
        .trim(),
    ),
  ).toBe('#151B18');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole('navigation', { name: '主要導覽' })
    .getByRole('button', { name: '首頁', exact: true })
    .click();
  await page.screenshot({
    path: `pwa-runtime/aligned-desktop-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test('login password visibility retains the entered value', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const password = page.getByLabel('密碼', { exact: true });
  await password.fill('visibility-test');
  await page.getByRole('button', { name: '顯示密碼', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('visibility-test');
  await page.getByRole('button', { name: '隱藏密碼', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.screenshot({
    path: `pwa-runtime/aligned-login-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('marketplace unifies purchases, listings, sales and conversations', async ({
  page,
}) => {
  await login(page);
  await page.context().route('https://example.com/photo.png', route =>
    route.fulfill({
      body: readFileSync('web/public/icons/icon-192.png'),
      contentType: 'image/png',
    }),
  );
  const other = '22222222-2222-4222-8222-222222222222';
  const listing = (id: string, seller: string, status = 'active') => ({
    id,
    seller_id: seller,
    title: id === 'own' ? '我的收納盒' : '木製置物架',
    description: '商品描述',
    category: '其他',
    price: 200,
    location: '台北',
    image_path: 'https://example.com/photo.png',
    status,
    created_at: '2026-10-01T00:00:00Z',
    condition: '正常使用',
    allow_meetup: true,
    allow_shipping: false,
    version: 1,
  });
  const own = listing('own', user.id),
    foreign = listing('foreign', other);
  const purchase = (
    id: string,
    buyer: string,
    seller: string,
    status: string,
  ) => ({
    id,
    buyer_id: buyer,
    seller_id: seller,
    status,
    total_amount: 260,
    shipping_fee: 60,
    created_at: '2026-10-01T00:00:00Z',
    recipient_name: '測試收件人',
    recipient_phone: '0912345678',
    shipping_address: '測試地址',
    order_items: [
      { title_snapshot: '訂單收納盒', price_snapshot: 200, listing_id: 'own' },
    ],
  });
  const buying = purchase('buy-order', user.id, other, 'shipped'),
    selling = purchase('sell-order', other, user.id, 'pending');
  let edited = false;
  const messages = [
    {
      id: 'm1',
      sender_id: other,
      content: '請問商品還在嗎？',
      created_at: '2026-10-01T00:00:00Z',
    },
  ];
  await page.context().route(/\/rest\/v1\//, async route => {
    const request = route.request(),
      url = new URL(request.url()),
      name = url.pathname.split('/').pop();
    if (name === 'listings') {
      if (request.method() === 'PATCH') {
        const body = request.postDataJSON();
        edited = body.title === '修改後的收納盒';
        own.title = body.title;
        await route.fulfill({ json: [{ id: 'own' }] });
      } else if (request.method() === 'HEAD')
        await route.fulfill({ headers: { 'content-range': '0-0/1' } });
      else
        await route.fulfill({
          json: url.searchParams.has('id')
            ? own
            : url.searchParams.has('seller_id')
            ? [own]
            : [own, foreign],
        });
    } else if (name === 'orders')
      await route.fulfill({
        json: url.searchParams.has('buyer_id') ? [buying] : [selling],
      });
    else if (name === 'transition_market_order') {
      const body = request.postDataJSON();
      expect(body.p_action).toBe('ship');
      expect(body.p_order_id).toBe('sell-order');
      selling.status = 'shipped';
      await route.fulfill({ json: null });
    } else if (name === 'conversations')
      await route.fulfill({
        json:
          request.method() === 'GET'
            ? [
                {
                  id: 'conversation',
                  buyer_id: other,
                  seller_id: user.id,
                  last_message_at: '2026-10-01T00:00:00Z',
                  listing: own,
                },
              ]
            : null,
      });
    else if (name === 'messages') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        expect(body.sender_id).toBe(user.id);
        const message = {
          id: 'm2',
          sender_id: body.sender_id,
          content: body.content,
          created_at: '2026-10-01T00:00:00Z',
        };
        messages.push(message);
        await route.fulfill({ json: message });
      } else await route.fulfill({ json: messages });
    } else await route.fallback();
  });
  await page.evaluate(() => {
    location.hash = 'market';
  });
  await expect(
    page.getByRole('button', { name: '買家專區', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '木製置物架' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '＋刊登商品', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `pwa-runtime/market-buyer-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.evaluate(() => {
    location.hash = 'settings';
  });
  await page.getByLabel('深色模式').check();
  await page.evaluate(() => {
    location.hash = 'market';
  });
  await expect(page.getByRole('heading', { name: '木製置物架' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: `pwa-runtime/market-dark-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.evaluate(() => {
    location.hash = 'settings';
  });
  await page.getByLabel('深色模式').uncheck();
  await page.evaluate(() => {
    location.hash = 'market';
  });
  await page.getByRole('button', { name: '我的交易', exact: true }).click();
  await page.getByRole('button', { name: '我的購買', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '確認收貨', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '確認出貨', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '我的刊登', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的收納盒' })).toBeVisible();
  await page.screenshot({
    path: `pwa-runtime/market-seller-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '編輯商品', exact: true }).click();
  await expect(page.getByLabel('商品名稱')).toHaveValue('我的收納盒');
  await page.getByLabel('商品名稱').fill('修改後的收納盒');
  await page
    .getByRole('button', { name: '下一步：交易方式', exact: true })
    .click();
  await page.getByRole('button', { name: '新增交易方式', exact: true }).click();
  await page.getByLabel('交易方式 1', { exact: true }).selectOption('meetup');
  await page.getByRole('button', { name: '預覽商品', exact: true }).click();
  await page.getByRole('button', { name: '儲存修改', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '商品修改成功' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '管理我的刊登', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '修改後的收納盒' }),
  ).toBeVisible();
  expect(edited).toBeTruthy();
  await page.getByRole('button', { name: '銷售訂單', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '確認出貨', exact: true }),
  ).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '確認出貨', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '確認出貨', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('article strong').filter({ hasText: '已出貨' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '訊息中心', exact: true }).click();
  await page.getByRole('button', { name: /修改後的收納盒.*買家/ }).click();
  await expect(page.getByText('請問商品還在嗎？')).toBeVisible();
  await page.getByLabel('訊息', { exact: true }).fill('還在，可以下單。');
  await page.getByRole('button', { name: '送出', exact: true }).click();
  await expect(page.getByText('還在，可以下單。')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test('marketplace searches all backend rows with sorting, ranges, paging and recovery', async ({
  page,
}) => {
  await login(page);
  const requests: URL[] = [];
  await page.context().route(/\/rest\/v1\/listings/, async route => {
    const url = new URL(route.request().url());
    requests.push(url);
    if (url.searchParams.get('or')?.includes('失敗')) {
      await route.fulfill({
        status: 400,
        json: { message: '市集暫時無法載入' },
      });
      return;
    }
    const searching = url.searchParams.get('or')?.includes('桌子');
    const rows = Array.from({ length: searching ? 1 : 20 }, (_, i) => ({
      id: `${url.searchParams.get('offset') || '0'}-${i}`,
      seller_id: 'other',
      title: searching ? '找到跨頁桌子' : `商品 ${i}`,
      price: 250,
      category: '其他',
      location: '台北',
      image_path: '',
      status: 'active',
    }));
    await route.fulfill({ json: rows });
  });
  await page.evaluate(() => {
    location.hash = 'market';
  });
  await expect(page.locator('.market-product-card')).toHaveCount(20);
  await page.getByRole('button', { name: '載入更多商品' }).click();
  await expect(page.locator('.market-product-card')).toHaveCount(40);
  expect(
    requests.some(url => url.searchParams.get('offset') === '20'),
  ).toBeTruthy();
  await page.getByLabel('搜尋商品', { exact: true }).fill('桌子');
  await expect(
    page.getByRole('heading', { name: '找到跨頁桌子' }),
  ).toBeVisible();
  expect(requests.at(-1)?.searchParams.get('offset')).toBe('0');
  await page.getByRole('button', { name: '篩選與排序' }).click();
  await page.getByLabel('排序', { exact: true }).selectOption('priceDesc');
  await page.getByLabel('最低價格').fill('100');
  await page.getByLabel('最高價格').fill('300');
  await page.getByRole('button', { name: '套用價格' }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get('price'))
    .toBe('gte.100');
  expect(requests.at(-1)?.searchParams.getAll('price')).toEqual([
    'gte.100',
    'lte.300',
  ]);
  expect(requests.at(-1)?.searchParams.get('order')).toContain('price.desc');
  await page.getByLabel('搜尋商品', { exact: true }).fill('失敗');
  await expect(page.getByRole('alert')).toContainText('市集暫時無法載入');
  await page.getByRole('button', { name: '清除搜尋', exact: true }).click();
  await expect(page.locator('.market-product-card')).toHaveCount(20);
  await page.screenshot({
    path: `pwa-runtime/market-grid-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('listing copies owned inventory, previews and submits once with success actions', async ({
  page,
}) => {
  await login(page);
  let created = 0;
  let savedListing: Record<string, unknown> | null = null;
  await page.context().route(/\/rest\/v1\/items/, route =>
    route.fulfill({
      json: [
        {
          id: 'item',
          name: '我的桌子',
          category: '大型家具',
          quantity: 1,
          image_path: null,
          source: 'manual',
        },
      ],
    }),
  );
  await page
    .context()
    .route(/\/storage\/v1\/object\/product-photos\//, route =>
      route.fulfill({ json: { Key: 'test/photo.png' } }),
    );
  await page.context().route(/\/rest\/v1\/listings/, async route => {
    if (route.request().method() === 'POST') {
      created++;
      const body = route.request().postDataJSON();
      savedListing = { ...body, id: 'published' };
      await route.fulfill({ json: savedListing });
    } else
      await route.fulfill({
        json: new URL(route.request().url()).searchParams.has(
          'client_request_id',
        )
          ? null
          : new URL(route.request().url()).searchParams.has('id')
          ? savedListing
          : [],
      });
  });
  await page.evaluate(() => {
    location.hash = 'market';
  });
  await page.getByRole('button', { name: '＋刊登商品', exact: true }).click();
  await page.getByRole('button', { name: '從我的物品中選擇' }).click();
  await page.getByRole('button', { name: /我的桌子.*大型家具/ }).click();
  await expect(page.getByLabel('商品名稱', { exact: true })).toHaveValue(
    '我的桌子',
  );
  await expect(page.getByLabel('分類', { exact: true })).toHaveValue(
    '大型家具',
  );
  await page
    .getByLabel('從相簿選擇', { exact: true })
    .setInputFiles('web/public/icons/icon-192.png');
  await page.getByLabel('價格', { exact: true }).fill('0');
  await page.getByLabel('地點', { exact: true }).fill('台北');
  await page
    .getByLabel('商品描述', { exact: true })
    .fill('桌面完整，邊緣有使用痕跡。');
  await page.getByLabel('使用狀況', { exact: true }).selectOption('正常使用');
  await page
    .getByRole('button', { name: '下一步：交易方式', exact: true })
    .click();
  await page.getByLabel('交易方式 1', { exact: true }).selectOption('meetup');
  await page.getByRole('button', { name: '預覽商品', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '確認商品資訊' }),
  ).toBeVisible();
  await expect(page.getByText('NT$ 0', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '確認上架', exact: true }).dblclick();
  await expect(
    page.getByRole('heading', { name: '商品刊登成功' }),
  ).toBeVisible();
  expect(created).toBe(1);
  await expect(
    page.getByRole('button', { name: '管理我的刊登', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '查看商品', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '管理我的刊登', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '加入購物車', exact: true }),
  ).toHaveCount(0);
});
test('buyer adds one cart item, checks out and sees purchase without switching identity', async ({
  page,
}) => {
  await login(page);
  const seller = '22222222-2222-4222-8222-222222222222';
  const listing = {
    id: 'buy-item',
    seller_id: seller,
    title: '購買測試桌子',
    price: 450,
    category: '大型家具',
    location: '台北',
    description: '桌面完整',
    image_path: '',
    status: 'active',
    condition: '正常使用',
    allow_meetup: false,
    allow_shipping: true,
    shipping_note: '自行貨到付款',
    shipping_fee: 60,
    version: 1,
  };
  let cart = false,
    checkouts = 0;
  await page.context().route(/\/rest\/v1\//, async route => {
    const url = new URL(route.request().url()),
      name = url.pathname.split('/').pop();
    if (name === 'listings')
      await route.fulfill({
        json: url.searchParams.has('id') ? listing : [listing],
      });
    else if (name === 'cart_items') {
      if (route.request().method() === 'POST') {
        cart = true;
        await route.fulfill({ json: null });
      } else await route.fulfill({ json: cart ? [{ listing }] : [] });
    } else if (name === 'create_market_requests') {
      checkouts++;
      const body = route.request().postDataJSON();
      expect(body.p_items).toEqual([
        { id: 'buy-item', method: 'shipping', channel: 'shipping', version: 1 },
      ]);
      expect(body.p_recipient.name).toBe('測試收件人');
      cart = false;
      await route.fulfill({ json: ['purchase'] });
    } else if (name === 'orders')
      await route.fulfill({
        json: [
          {
            id: 'purchase',
            buyer_id: user.id,
            seller_id: seller,
            status: 'requested',
            workflow_version: 2,
            delivery_method: 'shipping',
            version: 1,
            total_amount: 510,
            shipping_fee: 60,
            created_at: new Date().toISOString(),
            recipient_name: '測試收件人',
            recipient_phone: '0912345678',
            shipping_address: '測試地址',
            order_items: [
              {
                title_snapshot: listing.title,
                price_snapshot: 450,
                listing_id: listing.id,
              },
            ],
          },
        ],
      });
    else await route.fallback();
  });
  await page.evaluate(() => {
    location.hash = 'market';
  });
  await page.getByRole('button', { name: /購買測試桌子/ }).click();
  await expect(page.getByRole('button', { name: '分享商品' })).toBeVisible();
  await page.getByRole('button', { name: '加入購物車', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('已加入購物車');
  await page.evaluate(() => {
    location.hash = 'cart';
  });
  await expect(
    page.getByRole('heading', { name: '商品小計 NT$ 450' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '前往結帳' }).click();
  await page.getByLabel('收件人', { exact: true }).fill('測試收件人');
  await page.getByLabel('電話', { exact: true }).fill('0912345678');
  await page.getByLabel('地址', { exact: true }).fill('測試地址');
  await page
    .getByRole('button', { name: '送出 1 筆購買請求', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '已送出購買請求', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/目前尚未保留商品/)).toBeVisible();
  expect(checkouts).toBe(1);
  await page
    .getByRole('button', { name: '返回市集', exact: true })
    .last()
    .click();
  await page.getByRole('button', { name: '我的交易', exact: true }).click();
  await page.getByRole('button', { name: '我的刊登', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '我的刊登', exact: true }),
  ).toBeVisible();
});
async function login(page: Page) {
  await page.context().route(/\/auth\/v1\//, async route => {
    await route.fulfill({
      json: route.request().url().includes('/token')
        ? {
            access_token: token,
            refresh_token: 'test-refresh',
            token_type: 'bearer',
            expires_in: 3600,
            user,
          }
        : user,
    });
  });
  await page.context().route(/\/rest\/v1\//, async route => {
    await route.fulfill({
      json: route.request().url().includes('has_current_legal_acceptance')?true:route.request().url().includes('user_personas') ? null : [],
      headers: { 'content-range': '0-0/0' },
    });
  });
  await page.goto('/');
  await page.getByRole('button', {name:'登入',exact:true}).click();
  await page.getByLabel('電子信箱').fill(user.email);
  await page.getByLabel('密碼', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '收納魔法學院' }),
  ).toBeVisible();
}

test('donation/recycling carries item category, filters local channels and links official sources', async ({
  page,
}) => {
  await login(page);
  await page.context().route(/\/rest\/v1\/items\?/, route =>
    route.fulfill({
      json: [
        {
          id: 'guide-item',
          name: '木製桌椅',
          category: '大型家具',
          quantity: 1,
        },
      ],
    }),
  );
  await page.evaluate(() => {
    location.hash = 'items';
  });
  await page
    .getByRole('button', { name: '查詢這件物品的處理管道', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '捐贈與回收', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('物品類別')).toHaveValue('furniture');
  await page.getByLabel('物品狀況').selectOption('broken');
  await expect(
    page.getByRole('button', { name: '捐贈', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '全部管道', exact: true }),
  ).toHaveCount(0);
  const recyclingMap = page.getByRole('link', {
    name: '在地圖查附近回收／清運單位',
    exact: true,
  });
  expect(
    decodeURIComponent((await recyclingMap.getAttribute('href'))!),
  ).not.toContain('捐贈');
  await expect(
    page.locator('.guide-resource .guide-tag').filter({ hasText: '捐贈' }),
  ).toHaveCount(0);
  await page.getByLabel('所在地區').selectOption('新北市');
  await expect(
    page.getByRole('heading', { name: '新北市大型家具線上預約' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '臺北市大型物品預約清運' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '查看公益單位目前物資需求' }),
  ).toHaveCount(0);
  const official = page.getByRole('link', {
    name: /查看官方資訊\s*：新北市大型家具/,
  });
  await expect(official).toHaveAttribute(
    'href',
    'https://recycle.ntpc.gov.tw/Article/Index/category55',
  );
  await expect(official).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(
    page.getByRole('heading', { name: '全台回收據點與分類查詢' }),
  ).toBeVisible();
  await page.getByLabel('物品類別').selectOption('books');
  await page.getByLabel('所在地區').selectOption('臺北市');
  await page.getByLabel('物品狀況').selectOption('usable');
  await page.getByRole('button', { name: '捐贈', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '臺北市立圖書館圖書捐贈' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `pwa-runtime/donation-guide-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '刊登二手商品', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '刊登商品', exact: true }),
  ).toBeVisible();
});
test('home separates marketplace and donation; item actions follow condition', async ({
  page,
}) => {
  await login(page);
  await page.context().route('https://example.com/inventory-chair.jpg', r =>
    r.fulfill({
      body: readFileSync('web/public/icons/icon-192.png'),
      contentType: 'image/png',
    }),
  );
  await page.evaluate(() => {
    location.hash = 'home';
  });
  await expect(
    page.getByRole('button', { name: /二手市集.*買賣物品/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /捐贈與回收.*找捐贈單位/ }).click();
  await expect(
    page.getByRole('heading', { name: '捐贈與回收', exact: true }),
  ).toBeVisible();
  await page.context().route(/\/rest\/v1\/items\?/, route =>
    route.fulfill({
      json: [
        {
          id: 'action-item',
          image_path: 'https://example.com/inventory-chair.jpg',
          name: '木製桌椅',
          category: '家具',
          quantity: 1,
        },
      ],
    }),
  );
  await page.evaluate(() => {
    location.hash = 'items';
  });
  const condition = page.getByLabel('物品狀況：木製桌椅');
  await condition.selectOption('usable');
  await expect(
    page.getByRole('button', { name: '出售', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '捐贈', exact: true }).click();
  await expect(page.getByLabel('物品狀況')).toHaveValue('usable');
  await expect(
    page.getByRole('button', { name: '捐贈', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => {
    location.hash = 'items';
  });
  await condition.selectOption('usable');
  await page.getByRole('button', { name: '出售', exact: true }).click();
  await expect(page.locator('input[name="title"]')).toHaveValue('木製桌椅');
  await expect(page.locator('select[name="category"]')).toHaveValue('家具');
  await expect(
    page.locator('img[src="https://example.com/inventory-chair.jpg"]'),
  ).toHaveCount(1);
  await expect(page.getByLabel('拍攝照片', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('從相簿選擇', { exact: true })).toHaveCount(1);
  await page.evaluate(() => {
    location.hash = 'items';
  });
  await condition.selectOption('broken');
  await expect(
    page.getByRole('button', { name: '出售', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '捐贈', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '回收／清運', exact: true }).click();
  await expect(page.getByLabel('物品狀況')).toHaveValue('broken');
  await expect(
    page.getByRole('button', { name: '捐贈', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test('donation district selection, cross-district discovery and county referral', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    location.hash = 'donation';
  });
  await page.getByLabel('所在地區').selectOption('臺北市');
  await page.getByLabel('鄉鎮市區').selectOption('中山區');
  await expect(
    page.getByRole('heading', { name: '中山社會福利服務中心', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '中山區清潔隊', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '大安社會福利服務中心', exact: true }),
  ).toHaveCount(0);
  const maps = page.getByRole('link', {
    name: '在地圖查附近捐贈／回收單位',
    exact: true,
  });
  expect(decodeURIComponent((await maps.getAttribute('href'))!)).toContain(
    '臺北市中山區',
  );
  await page.getByLabel('也顯示同縣市其他區據點').check();
  await expect(
    page.getByRole('heading', { name: '大安社會福利服務中心', exact: true }),
  ).toBeVisible();
  await page.getByLabel('所在地區').selectOption('桃園市');
  await expect(page.getByLabel('鄉鎮市區')).toHaveValue('');
  await page.getByLabel('鄉鎮市區').selectOption('中壢區');
  await expect(
    page.getByRole('heading', { name: '中壢家庭服務中心', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '桃園家庭服務中心', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('所在地區').selectOption('金門縣');
  await page.getByLabel('鄉鎮市區').selectOption('金城鎮');
  await expect(
    page.getByText(
      '目前尚未整理到這個區符合條件的已查核據點。可聯絡下列縣市窗口，或用地圖查詢附近單位。',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '金門縣捐贈諮詢窗口', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('電話：082-318823 分機 67518')).toBeVisible();
  await page.getByLabel('所在地區').selectOption('全台');
  await expect(page.getByLabel('鄉鎮市區')).toBeDisabled();
  await expect(page.getByLabel('鄉鎮市區')).toHaveValue('');
});
test('PWA manifest, Apple icon and gateway restrict sensitive routes', async ({
  request,
}) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe('standalone');
  expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBeTruthy();
  expect((await request.get('/.env')).status()).toBe(404);
  expect((await request.get('/api/docs')).status()).toBe(404);
  expect(
    (await request.post('/api/chat', { data: { message: 'test' } })).status(),
  ).toBe(401);
  const html = await request.get('/');
  expect(html.headers()['content-security-policy']).toContain(
    "frame-ancestors 'none'",
  );
});
test('original seven scenario images, choices and personality survive a complete quiz', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: '開啟入學試煉' }).click();
  const firstQuestion = page.getByRole('heading', {
    name: '上課鐘聲快響了，你剛用完魔法筆，會把它放在哪裡？',
  });
  await expect(firstQuestion).toBeVisible();
  for (let index = 1; index <= 7; index++) {
    const image = page.getByAltText(`第 ${index} 題情境圖`);
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate(node => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.locator('.choice').first().click();
  }
  await expect(
    page.getByRole('heading', { name: '魔法身分覺醒' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '遮醜結界師' })).toBeVisible();
  await expect(page.getByText(/你的魔法專長是/)).toBeVisible();
  await page.getByRole('button', { name: '進入魔法空間' }).click();
  await expect(
    page.getByRole('heading', { name: '讓整理，從一個角落開始' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '查看收納人格特質', exact: true }),
  ).toContainText('遮醜結界師');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test('daily task choices, photo retake and feedback use the selected task', async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole('navigation', { name: '主要導覽' })
    .getByRole('button', { name: '首頁', exact: true })
    .click();
  const choices = [
    '整理桌面上的一件物品',
    '把三本書放回原位',
    '清出一個抽屜角落',
  ];
  await page.route('**/api/daily-task', route =>
    route.fulfill({ json: { date: taipeiDate(), tasks: choices } }),
  );
  let feedbackTask = '';
  await page.route('**/api/daily-task/feedback', async route => {
    feedbackTask = route.request().postData() || '';
    await route.fulfill({
      json: { feedback: '書本已歸位，下一步可以依常用程度排列。' },
    });
  });
  await page.context().route(/\/storage\/v1\//, route =>
    route.fulfill({
      json: route.request().url().includes('/sign/')
        ? { signedURL: '/object/sign/check-in-photos/test.jpg?token=test' }
        : { Key: 'test.jpg' },
    }),
  );
  await page.getByRole('button', { name: /每日任務/ }).click();
  await expect(page.getByRole('radio')).toHaveCount(3);
  await page.getByRole('radio', { name: choices[1] }).check();
  await page.getByLabel('從相簿選擇', { exact: true }).setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: readFileSync('web/public/icons/icon-192.png'),
  });
  await expect(page.getByAltText('待提交的照片預覽')).toBeVisible();
  const first = await page.getByAltText('待提交的照片預覽').getAttribute('src');
  await page.getByLabel('拍攝照片', { exact: true }).setInputFiles({
    name: 'retake.png',
    mimeType: 'image/png',
    buffer: readFileSync('web/public/icons/apple-touch-icon.png'),
  });
  await expect
    .poll(() => page.getByAltText('待提交的照片預覽').getAttribute('src'))
    .not.toBe(first);
  await page.getByRole('button', { name: '提交成果並取得回饋' }).click();
  await expect(
    page.getByRole('heading', { name: '任務完成回饋' }),
  ).toBeVisible();
  expect(feedbackTask).toContain(choices[1]);
  await page.getByRole('radio', { name: choices[0] }).check();
  await expect(page.getByRole('heading', { name: '任務完成回饋' })).toHaveCount(
    0,
  );
});
test('photo analysis uploads image and displays detection with advice', async ({
  page,
}) => {
  await login(page);
  let receivedImage = false;
  await page.route('**/api/detect', route => {
    receivedImage =
      route.request().postDataBuffer()?.includes(Buffer.from('name="image"')) ??
      false;
    return route.fulfill({
      json: {
        detected_items: [{ name: '桌子', category: '家具類', count: 1 }],
        total_detections: 1,
        detection_boxes: [
          { name: '桌子', category: '家具類', x: 0, y: 0, width: 1, height: 1 },
        ],
      },
    });
  });
  await page.route('**/api/crop-items', route =>
    route.fulfill({
      json: {
        items: [
          {
            name: '桌子',
            category: '家具類',
            photoUri:
              'data:image/jpeg;base64,' +
              readFileSync('web/public/icons/icon-192.png').toString('base64'),
          },
        ],
      },
    }),
  );
  await page.route('**/api/chat', route => {
    expect(route.request().postDataJSON().mode).toBe('photo_analysis');
    return route.fulfill({ json: { reply: '先清空桌面，再依用途分類。' } });
  });
  await page.evaluate(() => {
    location.hash = 'analysis';
  });
  await page.getByLabel('從相簿選擇', { exact: true }).setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: readFileSync('web/public/icons/icon-192.png'),
  });
  await page.getByRole('button', { name: '開始分析', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '收納建議', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '產生建議', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '收納建議', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('桌子 · 家具類 · 1 件')).toBeVisible();
  await expect(page.getByText('先清空桌面，再依用途分類。')).toBeVisible();
  expect(receivedImage).toBeTruthy();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('detected objects save separate crop photos and show them in item management', async ({
  page,
}) => {
  await login(page);
  const photoBytes = readFileSync('web/public/icons/icon-192.png');
  const cropUri = 'data:image/jpeg;base64,' + photoBytes.toString('base64');
  let savedItems: any[] = [];
  const uploads: Buffer[] = [];
  const storedPhotos = new Map<string, Buffer>();
  const liveCrops = process.env.PWA_REAL_CROPS === '1';
  let actualCrops: any[] = [];
  await page.context().route(/\/storage\/v1\/object\//, route => {
    const path = new URL(route.request().url()).pathname.split(
      '/analysis-photos/',
    )[1];
    if (route.request().method() === 'GET')
      return route.fulfill({
        contentType: liveCrops ? 'image/jpeg' : 'image/png',
        body: storedPhotos.get(path) || photoBytes,
      });
    if (route.request().url().includes('/sign/'))
      return route.fulfill({
        json: { signedURL: `/object/sign/analysis-photos/${path}?token=test` },
      });
    uploads.push(route.request().postDataBuffer()!);
    storedPhotos.set(path, route.request().postDataBuffer()!);
    return route.fulfill({ json: { Key: 'test' } });
  });
  await page.context().route(/\/rest\/v1\/ai_analyses/, route =>
    route.fulfill({
      json: { id: 'crop-analysis', created_at: new Date().toISOString() },
    }),
  );
  await page.context().route(/\/rest\/v1\/items/, route => {
    if (route.request().method() === 'POST') {
      savedItems = route.request().postDataJSON();
      return route.fulfill({ status: 201, body: '' });
    }
    return route.fulfill({
      json: savedItems.map((item, index) => ({ ...item, id: `crop-${index}` })),
    });
  });
  await page.route('**/api/detect', route =>
    route.fulfill({
      json: {
        detected_items: [{ name: '廚房用品', category: '家用品類', count: 2 }],
        total_detections: 2,
        detection_boxes: [0, 0.5].map(x => ({
          name: '廚房用品',
          category: '家用品類',
          x,
          y: 0,
          width: 0.5,
          height: 1,
        })),
      },
    }),
  );
  await page.route('**/api/crop-items', async route => {
    expect(
      route.request().postDataBuffer()!.includes(Buffer.from('name="boxes"')),
    ).toBeTruthy();
    if (liveCrops) {
      // WebKit's intercepted postDataBuffer does not preserve arbitrary binary
      // bytes; read the actual normalized preview blob from the browser instead.
      const normalizedBytes = await page.evaluate(async () => {
        const preview = document.querySelector(
          'img.preview',
        ) as HTMLImageElement;
        const response = await fetch(preview.src);
        return Array.from(new Uint8Array(await response.arrayBuffer()));
      });
      const form = new FormData();
      form.append(
        'image',
        new Blob([Uint8Array.from(normalizedBytes)], { type: 'image/jpeg' }),
        'photo.jpg',
      );
      form.append(
        'boxes',
        JSON.stringify(
          [0, 0.5].map(x => ({
            name: '廚房用品',
            category: '家用品類',
            x,
            y: 0,
            width: 0.5,
            height: 1,
          })),
        ),
      );
      const response = await fetch('http://127.0.0.1:8000/crop-items', {
        method: 'POST',
        body: form,
      });
      expect(response.status).toBe(200);
      const payload = await response.json();
      actualCrops = payload.items;
      return route.fulfill({ json: payload });
    }
    return route.fulfill({
      json: {
        items: [0, 1].map(() => ({
          name: '廚房用品',
          category: '家用品類',
          photoUri: cropUri,
        })),
      },
    });
  });
  await page.route('**/api/chat', route =>
    route.fulfill({ status: 503, json: { detail: '收納建議暫時無法使用' } }),
  );
  await page.evaluate(() => {
    location.hash = 'analysis';
  });
  await page.getByLabel('從相簿選擇', { exact: true }).setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: photoBytes,
  });
  await page.getByRole('button', { name: '開始分析', exact: true }).click();
  await page.getByRole('button', { name: '產生建議', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('收納建議暫時無法使用');
  await expect(page.getByAltText(/廚房用品裁切預覽/)).toHaveCount(2);
  await page
    .getByRole('button', { name: '裁切物品並匯入物品管理', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '物品管理', exact: true }),
  ).toBeVisible();
  expect(savedItems).toHaveLength(2);
  expect(savedItems.every(item => item.quantity === 1)).toBeTruthy();
  expect(new Set(savedItems.map(item => item.image_path)).size).toBe(2);
  expect(
    savedItems.every(item => item.image_path.includes('/items/')),
  ).toBeTruthy();
  expect(uploads).toHaveLength(3);
  if (liveCrops) {
    expect(
      uploads[1].equals(
        Buffer.from(actualCrops[0].photoUri.split(',')[1], 'base64'),
      ),
    ).toBeTruthy();
    expect(uploads[1].equals(uploads[2])).toBeFalsy();
    expect(uploads[1].equals(uploads[0])).toBeFalsy();
  } else expect(uploads[1].equals(photoBytes)).toBeTruthy();
  await expect(page.getByAltText('廚房用品物品照片')).toHaveCount(2);
  if (liveCrops) {
    await expect
      .poll(() =>
        page
          .getByAltText('廚房用品物品照片')
          .first()
          .evaluate(node => (node as HTMLImageElement).naturalWidth),
      )
      .toBe(96);
    await page.screenshot({
      path: `pwa-runtime/real-item-crops-${test.info().project.name}.png`,
      fullPage: true,
    });
  }
  await expect(
    page.getByRole('heading', { name: '廚房用品', exact: true }),
  ).toHaveCount(2);
});
test('photo boxes support manual drawing, naming, moving, resizing and deleting', async ({
  page,
}) => {
  await login(page);
  const image = readFileSync('web/public/icons/icon-192.png');
  let cropBoxes: any[] = [];
  await page.route('**/api/detect', route =>
    route.fulfill({
      json: {
        detected_items: [{ name: '桌子', category: '家具', count: 1 }],
        total_detections: 1,
        detection_boxes: [
          {
            name: '桌子',
            category: '家具',
            x: 0.05,
            y: 0.05,
            width: 0.3,
            height: 0.3,
          },
        ],
      },
    }),
  );
  await page.route('**/api/crop-items', route => {
    const body = route.request().postDataBuffer()!.toString('utf8');
    const raw = body
      .split('name="boxes"')[1]
      .split('\r\n\r\n')[1]
      .split('\r\n')[0];
    cropBoxes = JSON.parse(raw);
    return route.fulfill({
      json: {
        items: cropBoxes.map(box => ({
          name: box.name,
          category: box.category,
          photoUri: 'data:image/jpeg;base64,' + image.toString('base64'),
        })),
      },
    });
  });
  await page.route('**/api/chat', route =>
    route.fulfill({ json: { reply: '先整理桌面。' } }),
  );
  await page.evaluate(() => {
    location.hash = 'analysis';
  });
  await page
    .getByLabel('從相簿選擇', { exact: true })
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: image });
  await page.getByRole('button', { name: '開始分析', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '收納建議', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '產生建議', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '收納建議', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '辨識框 1：桌子', exact: true })
    .click();
  await page.getByLabel('物品名稱', { exact: true }).fill('小桌子');
  await expect(page.getByAltText(/裁切預覽/)).toHaveCount(0);
  await page
    .getByRole('button', { name: '手動框選新增物品', exact: true })
    .click();
  await page.getByTestId('detection-stage').scrollIntoViewIfNeeded();
  let stage = (await page.getByTestId('detection-stage').boundingBox())!;
  await page.mouse.move(
    stage.x + stage.width * 0.55,
    stage.y + stage.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    stage.x + stage.width * 0.9,
    stage.y + stage.height * 0.9,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(page.locator('.detection-box:not(.draft)')).toHaveCount(2);
  await page.getByLabel('物品名稱', { exact: true }).fill('收納盒');
  await page.getByLabel('物品分類', { exact: true }).fill('收納用品');
  await expect(
    page.getByRole('button', { name: '辨識框 2：收納盒', exact: true }),
  ).toBeVisible();
  // Move the newly drawn box, then resize its lower-right corner.
  await page.getByTestId('detection-stage').scrollIntoViewIfNeeded();
  stage = (await page.getByTestId('detection-stage').boundingBox())!;
  await page.mouse.move(
    stage.x + stage.width * 0.65,
    stage.y + stage.height * 0.65,
  );
  await page.mouse.down();
  await page.mouse.move(
    stage.x + stage.width * 0.7,
    stage.y + stage.height * 0.7,
    { steps: 3 },
  );
  await page.mouse.up();
  const handle = (await page.locator('.detection-resize').boundingBox())!;
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    stage.x + stage.width * 0.85,
    stage.y + stage.height * 0.85,
    { steps: 3 },
  );
  await page.mouse.up();
  await page
    .getByRole('button', { name: '辨識框 1：小桌子', exact: true })
    .click();
  await page.getByRole('button', { name: '刪除此辨識框', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '辨識框 1：收納盒', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '更新單件裁切預覽', exact: true })
    .click();
  await expect(
    page.getByAltText('收納盒裁切預覽 1', { exact: true }),
  ).toBeVisible();
  expect(cropBoxes).toHaveLength(1);
  expect(cropBoxes[0].name).toBe('收納盒');
  expect(cropBoxes[0].category).toBe('收納用品');
  expect(cropBoxes[0].x).toBeGreaterThan(0.55);
  expect(cropBoxes[0].width).toBeLessThan(0.3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `pwa-runtime/manual-box-editor-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('failed photo submission keeps the preview for retry', async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole('navigation', { name: '主要導覽' })
    .getByRole('button', { name: '首頁', exact: true })
    .click();
  await page.route('**/api/daily-task', route =>
    route.fulfill({
      json: { date: taipeiDate(), tasks: ['整理桌面', '整理書架', '整理抽屜'] },
    }),
  );
  await page.route('**/api/daily-task/feedback', route =>
    route.fulfill({ status: 503, json: { detail: '稍後再試' } }),
  );
  await page.getByRole('button', { name: /每日任務/ }).click();
  await page.getByLabel('從相簿選擇', { exact: true }).setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: readFileSync('web/public/icons/icon-192.png'),
  });
  await expect(page.getByAltText('待提交的照片預覽')).toBeVisible();
  await page.getByRole('button', { name: '提交成果並取得回饋' }).click();
  await expect(page.getByRole('alert')).toHaveText('稍後再試');
  await expect(page.getByAltText('待提交的照片預覽')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '提交成果並取得回饋' }),
  ).toBeEnabled();
});

test('history includes item details and carries them into AI chat', async ({
  page,
}) => {
  await login(page);
  await page.context().route(/\/rest\/v1\/ai_analyses/, route =>
    route.fulfill({
      json: [
        {
          id: 'analysis-test',
          photo_path: '',
          summary: '書桌整理',
          advice_text: '先整理桌面。\n## 建議採購\n- 文件盒',
          created_at: '2026-10-01T00:00:00Z',
          items: [{ name: '書本', category: '書籍', quantity: 2 }],
        },
      ],
    }),
  );
  let context: unknown;
  await page.route('**/api/chat', route => {
    context = route.request().postDataJSON().items;
    return route.fulfill({ json: { reply: '先依主題分類書本。' } });
  });
  await page.evaluate(() => {
    location.hash = 'history';
  });
  await page.getByText('書桌整理', { exact: false }).click();
  await expect(page.getByText('書本 · 書籍 · 2 件')).toBeVisible();
  await expect(page.getByText('文件盒', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '針對這些物品詢問 AI' }).click();
  await expect(
    page.getByRole('heading', { name: '這次詢問的物品' }),
  ).toBeVisible();
  await page.getByLabel('你的問題').fill('書本怎麼整理？');
  await page.getByRole('button', { name: '送出', exact: true }).click();
  await expect
    .poll(() => context)
    .toEqual([{ name: '書本', category: '書籍', count: 2 }]);
  await page.getByRole('button', { name: '清除物品背景' }).click();
  await expect(
    page.getByRole('heading', { name: '這次詢問的物品' }),
  ).toHaveCount(0);
});

test('daily calendar prevents future check-ins and opens historical photo and feedback', async ({
  page,
}) => {
  await login(page);
  const date = taipeiDate();
  await page.evaluate(
    ({ date, id }) =>
      localStorage.setItem(
        `sorti_pwa:${id}:task:${date}`,
        JSON.stringify({
          date,
          tasks: ['整理桌面', '整理抽屜', '整理書架'],
          task: '整理桌面',
          completedTask: '整理桌面',
          feedback: '桌面更整齊了。',
        }),
      ),
    { date, id: user.id },
  );
  await page.context().route(/\/rest\/v1\/check_ins/, route =>
    route.fulfill({
      json: [{ check_in_date: date, photo_path: `${user.id}/daily.jpg` }],
    }),
  );
  await page
    .context()
    .route(/\/storage\/v1\/object\/sign\//, route =>
      route.fulfill({ json: { signedURL: '/object/public/test.png' } }),
    );
  await page.evaluate(() => {
    location.hash = 'daily';
  });
  const calendar = page.getByRole('region', { name: '打卡日曆' });
  await calendar.getByRole('button', { name: `${date} 已打卡` }).click();
  await expect(calendar.getByText('桌面更整齊了。')).toBeVisible();
  await expect(calendar.getByAltText(`${date} 打卡照片`)).toBeVisible();
  await calendar.getByRole('button', { name: '下個月' }).click();
  expect(
    await calendar.locator('.check-in-calendar button:not(:disabled)').count(),
  ).toBe(0);
  await calendar.getByRole('button', { name: '上個月' }).click();
  await expect(
    calendar.getByRole('button', { name: `${date} 已打卡` }),
  ).toBeEnabled();
});

test('account editing saves shared metadata and password and exposes support settings', async ({
  page,
}) => {
  await login(page);
  let update: any;
  await page.context().route(/\/auth\/v1\/user/, route => {
    if (route.request().method() === 'PUT') {
      update = route.request().postDataJSON();
      return route.fulfill({ json: { ...user, user_metadata: update.data } });
    }
    return route.fulfill({ json: user });
  });
  await page.evaluate(() => {
    location.hash = 'profile';
  });
  await page.getByLabel('姓名', { exact: true }).fill('測試使用者');
  await page.getByLabel('使用者名稱', { exact: true }).fill('sorti-test');
  await page.getByLabel('性別', { exact: true }).fill('不便透露');
  await page.getByLabel('新密碼', { exact: true }).fill('new-password-123');
  await page.getByRole('button', { name: '儲存資料' }).click();
  await expect(page.getByRole('status')).toContainText('個人資料已儲存');
  expect(update.data).toEqual({
    display_name: '測試使用者',
    username: 'sorti-test',
    gender: '不便透露',
  });
  expect(update.password).toBe('new-password-123');
  await page.evaluate(() => {
    location.hash = 'settings';
  });
  await page.getByText('資料與隱私說明', { exact: true }).click();
  await expect(page.getByText(/個人照片以私人儲存空間管理/)).toBeVisible();
  await expect(page.getByText(/系統推播目前尚未提供/)).toBeVisible();
});

test('space segmentation, cabinet context and preferences reach photo RAG advice', async ({
  page,
}) => {
  await login(page);
  const space = {
    room_type: '書房',
    summary: '左側層架與工作區',
    regions: [
      {
        id: 'r1',
        name: '左側層架',
        kind: 'storage',
        polygon: [
          { x: 0.1, y: 0.1 },
          { x: 0.5, y: 0.1 },
          { x: 0.5, y: 0.9 },
        ],
        observation: '開放式層架',
      },
    ],
    storage_units: [
      { name: '左側層架', region_id: 'r1', observation: '可見兩層' },
    ],
    circulation: ['保留桌前走道'],
    limitations: ['櫃內容量未知'],
    overlay_uri:
      'data:image/png;base64,' +
      readFileSync('dist-pwa/icons/icon-192.png').toString('base64'),
  };
  let adviceRequest: any;
  await page.context().route(/\/rest\/v1\/user_personas/, route =>
    route.fulfill({
      json: {
        persona_name: '首席秩序官',
        visual_preference: 'minimal',
        detail_preference: 'detailed',
      },
    }),
  );
  await page.route('**/api/detect', route =>
    route.fulfill({
      json: {
        detected_items: [],
        detection_boxes: [],
        total_detections: 0,
        space_status: 'completed',
        space_analysis: space,
      },
    }),
  );
  await page.route('**/api/chat', route => {
    adviceRequest = route.request().postDataJSON();
    return route.fulfill({
      json: {
        reply:
          '### 空間與動線\n保留桌前走道。\n### 整理步驟\n1. 書本依類別放入左側層架。\n2. 先清空工作桌：把散落文具集中分類。\n常用文具保留在容易拿取的位置。\n3. 保留桌前走道：把暫放物品移回現有層架，不阻擋門口。\n### 建議採購\n- 無',
        retrieved_titles: ['物品定位法則'],
        retrieved_sources: [
          {
            title: '怦然心動整理法｜同類集中與固定位置',
            url: 'https://konmari.com/marie-kondo-hikidashi-boxes/',
            source_label: 'KonMari 官方整理技巧摘要',
          },
        ],
      },
    });
  });
  await page.evaluate(() => {
    location.hash = 'analysis';
  });
  await page.getByLabel('收納需求與限制（選填）').fill('租屋不能鑽牆');
  await page
    .locator('input[type=file]')
    .last()
    .setInputFiles('dist-pwa/icons/icon-192.png');
  await page.getByRole('button', { name: '開始分析', exact: true }).click();
  await expect(page.getByAltText('房間可見區域分區示意')).toBeVisible();
  await expect(page.getByText('左側層架：可見兩層')).toBeVisible();
  expect(adviceRequest).toBeUndefined();
  await expect(
    page.getByRole('button', { name: '手動框選新增物品', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /模擬圖|分析物品輪廓/ }),
  ).toHaveCount(0);
  await expect(page.locator('.advice-content')).toHaveCount(0);
  await page.getByRole('button', { name: '產生建議', exact: true }).click();
  await expect(page.locator('.knowledge-sources')).toHaveCount(0);
  await expect(page.getByText(/^整理偏好：/)).toHaveCount(0);
  await expect(
    page
      .locator('.advice-content')
      .getByRole('heading', { name: '空間與動線', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.advice-content')).not.toContainText('###');
  await expect(page.locator('.advice-step')).toHaveCount(3);
  await expect(page.locator('.advice-step').first()).toContainText(
    '書本依類別放入左側層架。',
  );
  await expect(page.locator('.advice-step-number')).toHaveText(['1', '2', '3']);
  await expect(
    page.locator('.advice-step').nth(1).getByRole('heading'),
  ).toHaveText('先清空工作桌');
  await expect(page.locator('.advice-step').nth(1)).toContainText(
    '常用文具保留在容易拿取的位置。',
  );
  await expect(
    page.getByRole('region', { name: '建議採購', exact: true }),
  ).not.toContainText('先清空工作桌');
  await page.screenshot({
    path: `pwa-runtime/advice-cards-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(adviceRequest.space_analysis.storage_units[0].name).toBe('左側層架');
  expect(adviceRequest.space_analysis.overlay_uri).toBeUndefined();
  expect(adviceRequest.storage_preferences).toEqual({
    visual_preference: 'minimal',
    detail_preference: 'detailed',
    notes: '租屋不能鑽牆',
  });
  expect(adviceRequest.user_persona).toBe('首席秩序官');
  await page.getByLabel('收納需求與限制（選填）').fill('優先使用現有櫃子');
  await expect(page.getByAltText('AI 模擬整理後照片')).toHaveCount(0);
  await page.getByRole('button', { name: '產生建議', exact: true }).click();
  await expect
    .poll(() => adviceRequest.storage_preferences.notes)
    .toBe('優先使用現有櫃子');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `pwa-runtime/space-analysis-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.route('**/api/chat', route =>
    route.fulfill({
      status: 502,
      contentType: 'text/html',
      body: '<html>Bad Gateway</html>',
    }),
  );
  await page.getByRole('button', { name: '重新產生建議', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('AI 服務連線中斷');
  await expect(page.getByRole('alert')).toContainText('HTTP 502');
  await expect(page.getByAltText('房間可見區域分區示意')).toBeVisible();
  await expect(page.getByLabel('收納需求與限制（選填）')).toHaveValue(
    '優先使用現有櫃子',
  );
  await page.route('**/api/chat', route =>
    route.fulfill({
      json: {
        reply: '### 整理步驟\n1. 集中分類書本：放回現有層架。',
        retrieved_titles: [],
      },
    }),
  );
  await page.getByRole('button', { name: '產生建議', exact: true }).click();
  await expect(page.locator('.advice-content')).toContainText('集中分類書本');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('inventory creates manual items, persists intent, filters and confirms deletion', async ({
  page,
}) => {
  await login(page);
  let account = {
    ...user,
    user_metadata: {
      item_dispositions: { 'seed-item': 'discard', 'seed-earphone': 'sell' },
    } as any,
  };
  let rows: any[] = [
    {
      id: 'seed-earphone',
      name: '耳機',
      category: '3C',
      quantity: 1,
      image_path: null,
    },
    {
      id: 'seed-item',
      name: '單字書',
      category: '書籍',
      quantity: 1,
      image_path: null,
    },
  ];
  let inserted: any;
  let deletedUrl = '';
  let deleteCount = 0;
  await page.context().route(/\/auth\/v1\/user/, route => {
    if (route.request().method() === 'PUT')
      account = {
        ...account,
        user_metadata: {
          ...account.user_metadata,
          ...route.request().postDataJSON().data,
        },
      };
    return route.fulfill({ json: account });
  });
  await page.context().route(/\/rest\/v1\/items/, route => {
    const request = route.request();
    if (request.method() === 'POST') {
      inserted = request.postDataJSON();
      rows.push({ id: 'manual-item', ...inserted });
      return route.fulfill({ status: 201, json: [] });
    }
    if (request.method() === 'DELETE') {
      deletedUrl = request.url();
      deleteCount++;
      rows = rows.filter(row => row.id !== 'manual-item');
      return route.fulfill({ status: 204 });
    }
    const url = new URL(request.url());
    if (url.searchParams.has('id'))
      return route.fulfill({ json: { id: 'manual-item' } });
    return route.fulfill({ json: rows });
  });
  await page.evaluate(() => {
    location.hash = 'items';
  });
  await expect(
    page.getByRole('heading', { name: '單字書', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '＋ 新增物品' }).click();
  await page.getByLabel('物品名稱', { exact: true }).fill('鉛筆');
  await page.getByLabel('分類', { exact: true }).fill('文具');
  await page.getByLabel('數量', { exact: true }).fill('3');
  await page.getByRole('button', { name: '儲存物品', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '鉛筆', exact: true }),
  ).toBeVisible();
  expect(inserted).toMatchObject({
    user_id: user.id,
    name: '鉛筆',
    category: '文具',
    quantity: 3,
    source: 'manual',
    image_path: null,
  });
  const pencil = page
    .locator('article.inventory-card')
    .filter({ has: page.getByRole('heading', { name: '鉛筆', exact: true }) });
  await pencil
    .getByRole('button', { name: '設定存放位置', exact: true })
    .click();
  await page.getByLabel('存放位置', { exact: true }).fill('書桌抽屜');
  await page.getByRole('button', { name: '儲存位置', exact: true }).click();
  await expect(pencil).toContainText(/已定位\s*· 存放位置：書桌抽屜/);
  expect(account.user_metadata.item_storage_locations['manual-item']).toBe(
    '書桌抽屜',
  );
  await page.reload();
  await expect(pencil).toContainText(/已定位\s*· 存放位置：書桌抽屜/);
  await page
    .getByRole('button', { name: '整理進度：待整理', exact: true })
    .click();
  await expect(pencil).toHaveCount(0);
  await page
    .getByRole('button', { name: '整理進度：已定位', exact: true })
    .click();
  await expect(pencil).toBeVisible();
  await page
    .getByRole('button', { name: '整理進度：全部', exact: true })
    .click();
  await page.screenshot({
    path: `pwa-runtime/inventory-cards-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '文具', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '單字書', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('管理狀態：鉛筆').selectOption('sell');
  await expect
    .poll(() => account.user_metadata.item_dispositions?.['manual-item'])
    .toBe('sell');
  await expect(
    page.getByText('待售是管理標記，出售前請另外刊登商品。'),
  ).toBeVisible();
  await page.getByLabel('篩選物品狀態').selectOption('keep');
  await expect(page.getByText('沒有符合搜尋或篩選條件的物品。')).toBeVisible();
  await page.getByLabel('篩選物品狀態').selectOption('all');
  await page.getByRole('button', { name: '刪除物品', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: '確認刪除物品' })).toBeInViewport();
  await page.getByRole('button', { name: '取消刪除' }).click();
  expect(deleteCount).toBe(0);
  expect(account.user_metadata.item_dispositions['seed-item']).toBe('discard');
  await page.getByRole('button', { name: '刪除物品', exact: true }).click();
  await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '鉛筆', exact: true }),
  ).toHaveCount(0);
  expect(deleteCount).toBe(1);
  expect(new URL(deletedUrl).searchParams.get('id')).toBe('eq.manual-item');
  expect(new URL(deletedUrl).searchParams.get('user_id')).toBe(`eq.${user.id}`);
});

for (const persona of Object.values(academyResults)) {
  test(`home preference badge displays original traits: ${persona.name}`, async ({
    page,
  }) => {
    await login(page);
    await page
      .context()
      .route(/\/rest\/v1\/user_personas/, route =>
        route.fulfill({ json: { persona_name: persona.name } }),
      );
    await page
      .getByRole('navigation', { name: '主要導覽' })
      .getByRole('button', { name: '首頁', exact: true })
      .click();
    const badge = page.getByRole('button', {
      name: '查看收納人格特質',
      exact: true,
    });
    await expect(badge).toContainText(persona.name);
    await badge.click();
    const details = page.getByRole('dialog', { name: '整理偏好特質' });
    await expect(
      details.getByRole('heading', { name: persona.name, exact: true }),
    ).toBeVisible();
    await expect(
      details.getByText(persona.feature, { exact: true }),
    ).toBeVisible();
    await expect(
      details.getByText(persona.desc, { exact: true }),
    ).toBeVisible();
    await expect(details).toContainText(persona.vLabel);
    await expect(details).toContainText(persona.dLabel);
    await details.getByRole('button', { name: '關閉', exact: true }).click();
    await expect(details).not.toBeVisible();
    await expect(badge).toBeFocused();
    await badge.click();
    await details
      .getByRole('button', { name: '重新測驗整理偏好', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: '收納魔法學院', exact: true }),
    ).toBeVisible();
  });
}

test('archive capture guidance can be dismissed permanently for the signed-in account', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    location.hash = 'analysis';
  });
  const guidance = page.getByRole('region', { name: '拍攝前注意事項' });
  await expect(guidance).toBeVisible();
  await expect(guidance).toContainText('先維持房間原狀');
  await guidance.getByLabel('以後不再提醒').check();
  await guidance.getByRole('button', { name: '了解，開始選擇照片' }).click();
  await expect(guidance).toHaveCount(0);
  await page.reload();
  await expect(guidance).toHaveCount(0);
  await expect(page.getByLabel('從相簿選擇', { exact: true })).toHaveCount(1);
});

test('archive advice saving works even when no objects were detected', async ({
  page,
}) => {
  await login(page);
  let saved: any;
  let itemInserts = 0;
  await page.route('**/api/detect', route =>
    route.fulfill({
      json: { detected_items: [], total_detections: 0, detection_boxes: [] },
    }),
  );
  await page.route('**/api/chat', route =>
    route.fulfill({
      json: {
        reply:
          '### 整理步驟\n1. 先確認保留物品：由衣物開始按類別整理。\n### 建議採購\n- 無',
      },
    }),
  );
  await page.context().route(/\/storage\/v1\//, route =>
    route.fulfill({
      json: route.request().url().includes('/sign/')
        ? { signedURL: '/object/sign/analysis-photos/test?token=test' }
        : { Key: 'test' },
    }),
  );
  await page.context().route(/\/rest\/v1\//, route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    if (name === 'ai_analyses' && route.request().method() === 'POST') {
      saved = route.request().postDataJSON();
      return route.fulfill({
        json: { id: 'advice-only', created_at: '2026-10-11T01:00:00Z' },
      });
    }
    if (name === 'items' && route.request().method() === 'POST') itemInserts++;
    if (name === 'ai_analyses' && saved)
      return route.fulfill({
        json: [
          {
            ...saved,
            id: 'advice-only',
            created_at: '2026-10-11T01:00:00Z',
            items: [],
          },
        ],
      });
    return route.fulfill({ json: name === 'user_personas' ? null : [] });
  });
  await page.evaluate(() => {
    location.hash = 'analysis';
  });
  await page
    .getByLabel('從相簿選擇', { exact: true })
    .setInputFiles('dist-pwa/icons/icon-192.png');
  await page.getByRole('button', { name: '開始分析', exact: true }).click();
  await page.getByRole('button', { name: '產生建議', exact: true }).click();
  await page.getByRole('button', { name: '儲存建議', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '整理紀錄', exact: true }),
  ).toBeVisible();
  await page.locator('main details summary').click();
  await expect(page.locator('.advice-content')).toContainText('先確認保留物品');
  expect(saved.advice_text).toContain('先確認保留物品');
  expect(saved.total_detections).toBe(0);
  expect(itemInserts).toBe(0);
});
test('unconfigured home badge offers quiz and long buttons remain readable in dark mode', async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole('navigation', { name: '主要導覽' })
    .getByRole('button', { name: '首頁', exact: true })
    .click();
  await page
    .getByRole('button', { name: '查看收納人格特質', exact: true })
    .click();
  const details = page.getByRole('dialog', { name: '整理偏好特質' });
  await expect(
    details.getByRole('heading', { name: '尚未設定整理偏好' }),
  ).toBeVisible();
  await expect(
    details.getByRole('button', { name: '開始收納測驗' }),
  ).toBeVisible();
  await details.getByRole('button', { name: '關閉', exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem('sorti_pwa_dark', 'true');
  });
  await page.reload();
  await page
    .getByRole('button', { name: '查看收納人格特質', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '24px';
  });
  const action = page.getByRole('button', {
    name: '開始收納測驗',
    exact: true,
  });
  const measured = await action.evaluate(button => {
    button.style.fontSize = '24px';
    button.textContent = '開始收納測驗，重新確認你的整理偏好與空間特質';
    return {
      height: button.clientHeight,
      scrollHeight: button.scrollHeight,
      width: button.clientWidth,
      scrollWidth: button.scrollWidth,
      color: getComputedStyle(button).color,
      background: getComputedStyle(button).backgroundColor,
    };
  });
  expect(measured.scrollHeight).toBeLessThanOrEqual(measured.height);
  expect(measured.scrollWidth).toBeLessThanOrEqual(measured.width);
  expect(measured.color).not.toBe(measured.background);
  await page.screenshot({
    path: `pwa-runtime/persona-dark-${test.info().project.name}.png`,
  });
});

test('direct purchase isolates the item and meetup needs no shipping address', async ({
  page,
}) => {
  await login(page);
  const listing = {
    id: 'direct-only',
    seller_id: '22222222-2222-4222-8222-222222222222',
    title: '直接購買測試',
    price: 100,
    location: '台北',
    image_path: '',
    description: '測試',
    category: '其他',
    status: 'active',
    version: 1,
    condition: '正常使用',
    allow_meetup: true,
    allow_shipping: false,
  };
  let submitted = 0,
    cartRead = 0;
  await page.context().route(/\/rest\/v1\//, async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    if (name === 'listings') await route.fulfill({ json: listing });
    else if (name === 'cart_items') {
      cartRead++;
      await route.fulfill({
        json: [{ listing: { ...listing, id: 'unselected-cart' } }],
      });
    } else if (name === 'create_market_requests') {
      submitted++;
      const b = route.request().postDataJSON();
      expect(b.p_items).toEqual([
        { id: 'direct-only', method: 'meetup', channel: 'meetup', version: 1 },
      ]);
      await route.fulfill({ json: ['direct-order'] });
    } else await route.fallback();
  });
  await page.evaluate(() => {
    sessionStorage.setItem('sorti-direct-buy', 'direct-only');
    location.hash = 'checkout';
  });
  await expect(
    page.getByRole('heading', { name: '直接購買測試' }),
  ).toBeVisible();
  await expect(page.getByLabel('收件人', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('寄送', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '送出 1 筆購買請求' }).dblclick();
  await expect(
    page.getByRole('heading', { name: '已送出購買請求' }),
  ).toBeVisible();
  expect(submitted).toBe(1);
  expect(cartRead).toBe(0);
});

test('market follows home colors and blocks buying legacy listings without delivery methods', async ({
  page,
}) => {
  await login(page);
  const listing = {
    id: 'legacy-no-delivery',
    seller_id: '22222222-2222-4222-8222-222222222222',
    title: '尚未設定方式的收納箱',
    price: 120,
    category: '其他',
    location: '台北',
    status: 'active',
    allow_meetup: false,
    allow_shipping: false,
    image_path: 'test.png',
  };
  await page.context().route(/\/rest\/v1\/listings/, route =>
    route.fulfill({
      json: new URL(route.request().url()).searchParams.has('id')
        ? listing
        : [listing],
    }),
  );
  await page.evaluate(() => {
    location.hash = 'market';
  });
  await expect(
    page.getByRole('button', { name: '＋刊登商品', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe('light');
  await page.getByText(listing.title, { exact: true }).click();
  await expect(
    page.getByText('賣家尚未設定交易方式，請先詢問賣家。'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '尚未開放購買', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '加入購物車', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '詢問賣家', exact: true }),
  ).toBeEnabled();
  await page
    .context()
    .route(/\/rest\/v1\/conversations/, route =>
      route.fulfill({ json: { id: 'independent-chat' } }),
    );
  await page.context().route(/\/rest\/v1\/messages/, route =>
    route.fulfill({
      json: [
        {
          id: 'chat-left',
          sender_id: '22222222-2222-4222-8222-222222222222',
          content: '你好，商品還在，可以約公開場所面交。',
          created_at: '2026-10-11T09:00:00Z',
        },
        {
          id: 'chat-right',
          sender_id: user.id,
          content: '謝謝！我想先確認尺寸，請問可以提供更多資訊嗎？',
          created_at: '2026-10-11T09:01:00Z',
        },
      ],
    }),
  );
  await page.getByRole('button', { name: '詢問賣家', exact: true }).click();
  await expect(page).toHaveURL(/#market-thread$/);
  await expect(
    page.getByRole('heading', { name: '商品聊聊', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '立即購買', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.messenger-row.mine')).toContainText('謝謝！');
  await expect(page.locator('.messenger-row:not(.mine)')).toContainText('你好');
  await page.screenshot({
    path: `pwa-runtime/messenger-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '商品聊聊', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '返回商品', exact: true }).click();
  await expect(page).toHaveURL(/#product$/);
  await expect(page.getByLabel('訊息', { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: `pwa-runtime/market-legacy-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('new listing selects a photo in stage one and keeps preview inside stage three', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    location.hash = 'add-product';
  });
  await expect(page.getByLabel('刊登進度').locator('li')).toHaveCount(3);
  await page
    .getByRole('button', { name: '下一步：商品資訊', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('請先拍攝或選擇商品照片');
  await page
    .getByLabel('從相簿選擇', { exact: true })
    .setInputFiles('web/public/icons/icon-192.png');
  await page
    .getByRole('button', { name: '下一步：商品資訊', exact: true })
    .click();
  await page.getByLabel('商品名稱', { exact: true }).fill('三步刊登測試');
  await page.getByLabel('價格', { exact: true }).fill('100');
  await page.getByLabel('地點', { exact: true }).fill('台北');
  await page.getByLabel('使用狀況', { exact: true }).selectOption('正常使用');
  await page
    .getByRole('button', { name: '下一步：交易方式', exact: true })
    .click();
  await page.getByLabel('交易方式 1', { exact: true }).selectOption('meetup');
  await page.getByRole('button', { name: '預覽商品', exact: true }).click();
  await expect(
    page.getByLabel('刊登進度').locator('[aria-current="step"]'),
  ).toContainText('交易與刊登');
  await page.getByRole('button', { name: '返回修改', exact: true }).click();
  await expect(page.getByLabel('交易方式 1', { exact: true })).toHaveValue(
    'meetup',
  );
  await page.screenshot({
    path: `pwa-runtime/market-listing-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('seller accepts through page confirmation and can retry a visible server error', async ({
  page,
}) => {
  await login(page);
  const order = {
    id: 'accept-order',
    buyer_id: '22222222-2222-4222-8222-222222222222',
    seller_id: user.id,
    workflow_version: 2,
    version: 1,
    status: 'requested',
    delivery_method: 'meetup',
    created_at: new Date().toISOString(),
    total_amount: 100,
    subtotal: 100,
    shipping_fee: 0,
    order_items: [],
    order_issues: [],
    order_events: [],
  };
  let calls = 0;
  await page
    .context()
    .route(/\/rest\/v1\/orders/, route => route.fulfill({ json: order }));
  await page
    .context()
    .route(/\/rest\/v1\/rpc\/market_order_action/, async route => {
      calls++;
      expect(route.request().postDataJSON()).toMatchObject({
        p_order_id: order.id,
        p_action: 'accept',
        p_version: 1,
      });
      if (calls === 1) {
        await route.fulfill({
          status: 400,
          json: { code: '22023', message: '訂單已更新，請重新整理後操作' },
        });
      } else {
        order.status = 'accepted';
        order.version++;
        await route.fulfill({ status: 204, body: '' });
      }
    });
  await page.evaluate(() => {
    sessionStorage.setItem('sorti-order-id', 'accept-order');
    location.hash = 'market-order';
  });
  await page.getByRole('button', { name: '接受訂單', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: '確認交易操作' });
  await expect(confirmation).toBeVisible();
  expect(calls).toBe(0);
  await confirmation.getByRole('button', { name: '返回', exact: true }).click();
  expect(calls).toBe(0);
  await page.getByRole('button', { name: '接受訂單', exact: true }).click();
  await confirmation
    .getByRole('button', { name: '確認接受訂單', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('訂單已更新');
  await page.getByRole('button', { name: '接受訂單', exact: true }).click();
  await confirmation
    .getByRole('button', { name: '確認接受訂單', exact: true })
    .dblclick();
  await expect(
    page.getByRole('button', { name: '接受訂單', exact: true }),
  ).toHaveCount(0);
  expect(calls).toBe(2);
});

test('order detail survives reload and a single meetup confirmation waits for the other party', async ({
  page,
}) => {
  await login(page);
  const order = {
    id: 'meetup-order',
    buyer_id: user.id,
    seller_id: '22222222-2222-4222-8222-222222222222',
    workflow_version: 2,
    version: 4,
    status: 'fulfilling',
    delivery_method: 'meetup',
    created_at: new Date().toISOString(),
    total_amount: 100,
    shipping_fee: 0,
    seller_handed_over_at: new Date().toISOString(),
    buyer_received_at: null,
    order_items: [],
    order_issues: [],
    order_events: [],
    meetup: {
      version: 1,
      proposed_by: '22222222-2222-4222-8222-222222222222',
      confirmed: true,
      starts_at: new Date().toISOString(),
      place: '捷運站公開出口',
      notes: '',
    },
  };
  await page
    .context()
    .route(/\/rest\/v1\/orders/, route => route.fulfill({ json: order }));
  await page.evaluate(() => {
    sessionStorage.setItem('sorti-order-id', 'meetup-order');
    location.hash = 'market-order';
  });
  await expect(
    page.getByText('賣家已交付，實際收到商品後請確認收貨。'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '我已收到商品', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '提出取消', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '訂單詳情', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('賣家交付：已確認')).toBeVisible();
  const progress = page.getByRole('list', { name: '交易進度' });
  await expect(progress.locator('[data-state="done"]')).toHaveCount(2);
  await expect(progress.locator('[aria-current="step"]')).toContainText(
    '已交付・待收貨',
  );
  await expect(progress.locator('[data-state="upcoming"]')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `pwa-runtime/dual-mode-meetup-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('transaction chat requests only messages after acceptance', async ({
  page,
}) => {
  await login(page);
  const since = '2026-10-11T09:00:00Z';
  let cutoff = '';
  await page.context().route(/\/rest\/v1\/messages/, async route => {
    cutoff =
      new URL(route.request().url()).searchParams.get('created_at') || '';
    await route.fulfill({
      json: [
        {
          id: 'after-acceptance',
          sender_id: user.id,
          content: '成立後約定面交',
          created_at: '2026-10-11T09:10:00Z',
        },
      ],
    });
  });
  await page.evaluate(since => {
    sessionStorage.setItem(
      'sorti-market-thread',
      JSON.stringify({
        id: 'transaction-chat',
        title: '交易商品',
        role: 'buyer',
        since,
      }),
    );
    location.hash = 'market-thread';
  }, since);
  await expect(page.getByText('成立後約定面交', { exact: true })).toBeVisible();
  expect(cutoff).toBe('gte.' + since);
  await page.reload();
  await expect(page.getByText('成立後約定面交', { exact: true })).toBeVisible();
  expect(cutoff).toBe('gte.' + since);
});

for (const method of ['meetup', 'shipping']) {
  test(`${method} seller fulfillment and buyer receipt follow separate stages`, async ({
    page,
  }) => {
    await login(page);
    const other = '22222222-2222-4222-8222-222222222222';
    const order = {
      id: 'new-flow-order',
      seller_id: user.id,
      buyer_id: other,
      workflow_version: 2,
      version: 1,
      status: 'accepted',
      delivery_method: method,
      created_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      subtotal: 100,
      shipping_fee: 0,
      total_amount: 100,
      order_items: [],
      order_issues: [],
      order_events: [],
      seller_handed_over_at: null as string | null,
      buyer_received_at: null as string | null,
      shipment: null as Record<string, string> | null,
    };
    await page
      .context()
      .route(/\/rest\/v1\/orders/, route => route.fulfill({ json: order }));
    const actions: string[] = [];
    await page
      .context()
      .route(/\/rest\/v1\/rpc\/market_order_action/, async route => {
        const body = route.request().postDataJSON();
        actions.push(body.p_action);
        if (body.p_action === 'handover') {
          if (order.seller_id === user.id)
            order.seller_handed_over_at = new Date().toISOString();
          else {
            order.buyer_received_at = new Date().toISOString();
            order.status = 'completed';
          }
        }
        if (body.p_action === 'ship')
          order.shipment = {
            dispatched_at: new Date().toISOString(),
            carrier: '郵局',
          };
        if (body.p_action === 'receive') {
          order.buyer_received_at = new Date().toISOString();
          order.status = 'completed';
        }
        if (order.status !== 'completed') order.status = 'fulfilling';
        order.version++;
        await route.fulfill({ status: 204, body: '' });
      });
    await page.evaluate(() => {
      sessionStorage.setItem('sorti-order-id', 'new-flow-order');
      location.hash = 'market-order';
    });
    await expect(
      page.getByRole('button', { name: '提出／修改面交安排', exact: true }),
    ).toHaveCount(0);
    if (method === 'meetup') {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page
        .getByRole('button', { name: '我已交付商品', exact: true })
        .click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(dialog).toBeInViewport();
      await expect(
        dialog.getByRole('button', { name: '確認已交付商品', exact: true }),
      ).toBeFocused();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /^確認/ })
        .click();
      await expect(
        page.getByText('你已確認交付，等待買家確認收貨。'),
      ).toBeVisible();
    } else {
      await page
        .getByRole('button', { name: '填寫出貨資訊', exact: true })
        .click();
      await page.getByLabel('實際寄件日期', { exact: true }).fill('2099-01-01');
      await page
        .getByRole('button', { name: '確認已實際寄件並送出', exact: true })
        .click();
      await expect(
        page.locator('.transaction-action-form').getByRole('alert'),
      ).toContainText('不能晚於今天');
      expect(actions).toEqual([]);
      await page.getByLabel('實際寄件日期', { exact: true }).fill('2026-10-10');
      const dateBounds = await page
        .getByLabel('實際寄件日期', { exact: true })
        .evaluate(el => {
          const input = el.getBoundingClientRect();
          const card = el.closest('.card')!.getBoundingClientRect();
          return {
            left: input.left >= card.left,
            right: input.right <= card.right,
          };
        });
      expect(dateBounds).toEqual({ left: true, right: true });
      const fieldWidths = await page
        .locator('.transaction-action-form')
        .evaluate(form => {
          const date = form
            .querySelector('input[type="date"]')!
            .getBoundingClientRect();
          const text = form
            .querySelector('input[type="text"]')!
            .getBoundingClientRect();
          return {
            difference: Math.abs(date.width - text.width),
            left: Math.abs(date.left - text.left),
          };
        });
      expect(fieldWidths.difference).toBeLessThanOrEqual(1);
      expect(fieldWidths.left).toBeLessThanOrEqual(1);

      await page
        .getByRole('button', { name: '確認已實際寄件並送出', exact: true })
        .click();
      await expect(
        page.getByText('已出貨，等待買家收到商品後確認收貨。'),
      ).toBeVisible();
    }
    order.seller_id = other;
    order.buyer_id = user.id;
    await page.reload();
    await page
      .getByRole('button', {
        name: method === 'meetup' ? '我已收到商品' : '確認收到商品',
        exact: true,
      })
      .click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /^確認/ })
      .click();
    await expect(
      page.getByText('交易已完成。此紀錄不代表平台驗證線下付款。'),
    ).toBeVisible();
    await expect(page.locator('.market-actions')).toHaveCount(0);
    expect(actions).toEqual(
      method === 'meetup' ? ['handover', 'handover'] : ['ship', 'receive'],
    );
  });
}

test('delivery dropdown lists six channels and keeps individual fees in listing preview', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    location.hash = 'add-product';
  });
  await page
    .getByLabel('從相簿選擇', { exact: true })
    .setInputFiles('web/public/icons/icon-192.png');
  await page
    .getByRole('button', { name: '下一步：商品資訊', exact: true })
    .click();
  await page.getByLabel('商品名稱', { exact: true }).fill('多管道測試');
  await page.getByLabel('價格', { exact: true }).fill('100');
  await page.getByLabel('地點', { exact: true }).fill('台北');
  await page.getByLabel('使用狀況', { exact: true }).selectOption('正常使用');
  await page
    .getByRole('button', { name: '下一步：交易方式', exact: true })
    .click();
  const select = page.getByLabel('交易方式 1', { exact: true });
  await expect(select.locator('option')).toHaveText([
    '面交',
    '7-ELEVEN',
    '全家',
    '萊爾富',
    'OK 超商',
    '宅配',
  ]);
  await select.selectOption('hi_life');
  await page.getByLabel('萊爾富運費（0 為免運）', { exact: true }).fill('45');
  await page.getByRole('button', { name: '新增交易方式', exact: true }).click();
  await page.getByLabel('交易方式 2', { exact: true }).selectOption('ok_mart');
  await page.getByLabel('OK 超商運費（0 為免運）', { exact: true }).fill('50');
  await expect(
    page
      .getByLabel('交易方式 2', { exact: true })
      .locator('option[value="hi_life"]'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '預覽商品', exact: true }).click();
  await expect(
    page.getByText('萊爾富、OK 超商', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '返回修改', exact: true }).click();
  await expect(
    page.getByLabel('萊爾富運費（0 為免運）', { exact: true }),
  ).toHaveValue('45');
});

test('store checkout uses seller channels and sends selected store snapshot', async ({
  page,
}) => {
  await login(page);
  let request: any;
  const listing = {
    id: 'store-product',
    seller_id: '22222222-2222-4222-8222-222222222222',
    title: '超商商品',
    price: 100,
    location: '台北',
    image_path: '',
    description: '',
    category: '其他',
    status: 'active',
    version: 1,
    condition: '正常使用',
    allow_meetup: true,
    allow_shipping: true,
    delivery_options: [
      { channel: 'ok_mart', fee: 50, note: '' },
      { channel: 'meetup', fee: 0, note: '' },
      { channel: 'home_delivery', fee: 100, note: '' },
    ],
  };
  await page.context().route(/\/rest\/v1\//, async route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').pop();
    if (endpoint === 'listings') await route.fulfill({ json: listing });
    else if (endpoint === 'create_market_requests') {
      request = route.request().postDataJSON();
      await route.fulfill({ json: ['store-order'] });
    } else await route.fallback();
  });
  await page.evaluate(() => {
    sessionStorage.setItem('sorti-direct-buy', 'store-product');
    location.hash = 'checkout';
  });
  await expect(page.getByLabel('收件人', { exact: true })).toBeVisible();
  await page.getByLabel('交易方式', { exact: true }).selectOption('ok_mart');
  await expect(page.getByLabel('地址', { exact: true })).toHaveCount(0);
  await page.getByLabel('收件人', { exact: true }).fill('測試收件人');
  await page.getByLabel('電話', { exact: true }).fill('0900000000');
  await page.getByLabel('門市名稱', { exact: true }).fill('測試門市');
  await page.getByLabel('門市店號', { exact: true }).fill('12345');
  await page.getByLabel('門市地址', { exact: true }).fill('高雄市測試地址');
  await page
    .getByRole('button', { name: '送出 1 筆購買請求', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '已送出購買請求' }),
  ).toBeVisible();
  expect(request.p_items[0]).toMatchObject({
    method: 'shipping',
    channel: 'ok_mart',
  });
  expect(request.p_recipient.stores.ok_mart.code).toBe('12345');
});

test('header back returns to previous screen instead of home', async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole('navigation', { name: '主要導覽' })
    .getByRole('button', { name: '首頁', exact: true })
    .click();
  await page.evaluate(() => {
    location.hash = 'market';
  });
  await expect(page.locator('.page-title')).toContainText('二手市集');
  await page.evaluate(() => {
    location.hash = 'settings';
  });
  await expect(page.locator('.page-title')).toContainText('設定');
  await page.getByRole('button', { name: '返回上一頁', exact: true }).click();
  await expect(page).toHaveURL(/#market$/);
});

test('seller storefront filters active listings and adds multiple products', async ({
  page,
}) => {
  await login(page);
  const seller = '22222222-2222-4222-8222-222222222222';
  let filtered = false;
  const added: string[] = [];
  await page.context().route('**/rest/v1/listings*', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('id'))
      return route.fulfill({ json: { seller_id: seller, status: 'active' } });
    filtered =
      url.searchParams.get('seller_id') === 'eq.' + seller &&
      url.searchParams.get('status') === 'eq.active';
    return route.fulfill({
      json: ['one', 'two'].map(id => ({
        id,
        seller_id: seller,
        title: '商品' + id,
        price: 100,
        status: 'active',
        image_path: '',
        allow_meetup: true,
        allow_shipping: false,
        version: 1,
        created_at: '2026-10-01',
      })),
    });
  });
  await page.context().route('**/rest/v1/cart_items*', async route => {
    if (route.request().method() === 'POST')
      added.push(route.request().postDataJSON().listing_id);
    await route.fulfill({ json: [] });
  });
  await page.evaluate(seller => {
    sessionStorage.setItem('sorti-seller-id', seller);
    location.hash = 'seller-store';
  }, seller);
  await expect(page.getByRole('heading', { name: '賣家賣場' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '商品one' })).toBeVisible();
  expect(filtered).toBe(true);
  await page
    .getByRole('button', { name: '加入購物車', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: '已加入購物車', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '加入購物車', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '已加入購物車', exact: true }),
  ).toHaveCount(2);
  expect(added).toEqual(['one', 'two']);
  await page.getByRole('button', { name: '查看購物車', exact: true }).click();
  await expect(page).toHaveURL(/#cart$/);
});

test('same seller checkout applies a shared channel and submits one grouped request', async ({
  page,
}) => {
  await login(page);
  const seller = '22222222-2222-4222-8222-222222222222';
  const products = ['one', 'two'].map((id, i) => ({
    id,
    seller_id: seller,
    title: '合購' + id,
    price: 100,
    status: 'active',
    image_path: '',
    version: 1,
    allow_meetup: true,
    allow_shipping: true,
    delivery_options: [
      { channel: 'meetup', fee: 0, note: '' },
      { channel: 'seven_eleven', fee: i ? 80 : 60, note: '' },
    ],
  }));
  let submitted = false;
  await page
    .context()
    .route('**/rest/v1/cart_items*', r =>
      r.fulfill({ json: products.map(listing => ({ listing })) }),
    );
  await page.context().route('**/rest/v1/rpc/create_market_requests', r => {
    const payload = r.request().postDataJSON();
    expect(payload.p_items.map((p: any) => p.channel)).toEqual([
      'meetup',
      'meetup',
    ]);
    expect(payload.p_items).toHaveLength(2);
    submitted = true;
    return r.fulfill({ json: ['combined-order'] });
  });
  await page.evaluate(() => {
    sessionStorage.removeItem('sorti-direct-buy');
    location.hash = 'checkout';
  });
  await expect(
    page.getByRole('heading', { name: '同賣家一起購買 · 2 件' }),
  ).toBeVisible();
  await page
    .getByLabel('合併交易方式', { exact: true })
    .selectOption('seven_eleven');
  for (const selector of await page
    .getByLabel('交易方式', { exact: true })
    .all())
    await expect(selector).toHaveValue('seven_eleven');
  await expect(page.getByLabel('門市名稱', { exact: true })).toBeVisible();
  await page.getByLabel('合併交易方式', { exact: true }).selectOption('meetup');
  await expect(page.getByLabel('收件人', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '送出 1 筆購買請求' }).click();
  await expect(
    page.getByRole('heading', { name: '已送出購買請求' }),
  ).toBeVisible();
  expect(submitted).toBe(true);
});

test('notifications show incoming events, save preferences and open the related order', async ({
  page,
}) => {
  await login(page);
  let prefs = { chat: true, orders: true };
  const notifications: any[] = [];
  let read = false;
  await page
    .context()
    .route('**/rest/v1/notification_preferences*', async r => {
      if (r.request().method() === 'POST')
        prefs = { ...prefs, ...r.request().postDataJSON() };
      await r.fulfill({ json: prefs });
    });
  await page.context().route('**/rest/v1/market_notifications*', async r => {
    if (r.request().method() === 'PATCH') {
      read = true;
      notifications[0].read_at = new Date().toISOString();
      await r.fulfill({ json: [] });
    } else await r.fulfill({ json: notifications });
  });
  await page
    .context()
    .route('**/rest/v1/orders*', r =>
      r.fulfill({
        json: {
          id: 'notice-order',
          buyer_id: user.id,
          seller_id: '22222222-2222-4222-8222-222222222222',
          workflow_version: 2,
          status: 'requested',
          delivery_method: 'meetup',
          created_at: new Date().toISOString(),
          order_items: [],
          order_events: [],
          order_issues: [],
        },
      }),
    );
  await page.clock.install();
  await page.reload();
  await page.getByRole('button', { name: '通知中心，0 則未讀' }).click();
  const dialog = page.getByRole('dialog', { name: '通知與設定' });
  await expect(dialog.getByText('目前沒有通知')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '允許此裝置背景通知' }),
  ).toBeDisabled();
  await dialog.getByLabel('訂單互動通知', { exact: true }).uncheck();
  await expect.poll(() => prefs.orders).toBe(false);
  await dialog.getByLabel('訂單互動通知', { exact: true }).check();
  await expect.poll(() => prefs.orders).toBe(true);
  await dialog.getByRole('button', { name: '關閉', exact: true }).click();
  notifications.push({
    id: 'notice-one',
    kind: 'orders',
    title: '交易有新進度',
    body: '賣家已接受訂單',
    target: { orderId: 'notice-order' },
    created_at: new Date().toISOString(),
    read_at: null,
  });
  await page.clock.runFor(16000);
  await expect(
    page.getByRole('alert').filter({ hasText: '賣家已接受訂單' }),
  ).toBeVisible();
  await page.getByRole('alert').filter({ hasText: '賣家已接受訂單' }).click();
  await expect(page).toHaveURL(/#market-order$/);
  expect(read).toBe(true);
  await expect(
    page.getByRole('button', { name: '通知中心，0 則未讀' }),
  ).toBeVisible();
});

test('assistant drags to both edges without opening chat and still opens on tap',async({page})=>{
 await login(page); await page.evaluate(()=>{location.hash='home';});
 const bear=page.getByRole('button',{name:'開啟收納助理',exact:true});
 await expect(bear).toBeVisible();
 const box=(await bear.boundingBox())!;
 await page.mouse.move(box.x+40,box.y+40);await page.mouse.down();await page.mouse.move(35,250,{steps:8});await page.mouse.up();
 await expect(bear).toBeVisible();expect((await bear.boundingBox())!.x).toBe(8);
 let rect=(await bear.boundingBox())!;await page.mouse.move(rect.x+30,rect.y+30);await page.mouse.down();await page.mouse.move(370,350,{steps:8});await page.mouse.up();
 rect=(await bear.boundingBox())!;expect(rect.x+rect.width).toBeLessThanOrEqual(page.viewportSize()!.width-8);
 await bear.click();await expect(page.getByRole('heading',{name:'收納助理',exact:true})).toBeVisible();
});

test('home header removes personal center and offsets brand',async({page})=>{
 await login(page);await page.evaluate(()=>{location.hash='home';});
 await expect(page.getByRole('button',{name:'個人中心',exact:true})).toHaveCount(0);
 await expect(page.locator('.home-brand-offset')).toBeVisible();
 await expect(page.locator('.home-brand-offset')).toHaveCSS('transform','none');
});

test('personal home shows greeting real counts and opens profile',async({page})=>{
 await login(page);await page.evaluate(()=>{location.hash='home';});
 await expect(page.getByText('你好，收納新手',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'開始整理',exact:false})).toBeVisible();
 await expect(page.getByText('管理 0 件物品 · 累積打卡 0 天',{exact:true})).toBeVisible();
 await page.screenshot({path:'pwa-runtime/personal-home-'+test.info().project.name+'.png',fullPage:true});
 await page.getByRole('button',{name:'編輯暱稱與頭貼'}).click();
 await expect(page.getByRole('heading',{name:'個人資料',exact:true})).toBeVisible();
});


test('assistant messenger sends and keeps composer beneath scrollable history', async ({page}) => {
 await login(page);
 const rows=Array.from({length:16},(_,i)=>({id:String(i),role:i%2?'assistant':'user',content:'整理書桌的建議 '+i,created_at:new Date(1700000000000+i*1000).toISOString()}));
 await page.context().route(/\/rest\/v1\/ai_chat_messages/,async route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();rows.push({...body,id:String(rows.length),created_at:new Date().toISOString()});await route.fulfill({json:null});}
  else await route.fulfill({json:rows});
 });
 await page.context().route('**/api/chat',route=>{
  const request=route.request().postDataJSON();
  const message=request.message;
  if(message==='沒有抽屜怎麼辦？'){
   expect(request.history.some((turn:{content:string})=>turn.content.includes('先把文具放進同一個收納盒。'))).toBe(true);
   return route.fulfill({json:{reply:'可以用現有的盒子分區，放在桌面角落，不需要另外購買。'}});
  }
  return route.fulfill({json:{reply:'1. 文具歸位：先把文具放進同一個收納盒。\n2. 文件分類：分成待處理與保存兩類。\n3. 固定位置：用完後放回原本的位置。'}});
 });
 await page.evaluate(()=>{location.hash='chat';});
 const log=page.getByRole('log',{name:'對話紀錄'});
 await expect(log.getByText('整理書桌的建議 15')).toBeVisible();
 const send=page.getByRole('button',{name:'送出訊息',exact:true});
 await expect(send).toBeDisabled();
 await page.getByLabel('你的問題').fill('書桌怎麼整理？');
 await expect(page.getByRole('navigation',{name:'主要導覽'})).toBeHidden();
 await expect(page.getByLabel('你的問題')).toHaveCSS('outline-style','none');
 await send.click();
 await expect(log.getByText('先把文具放進同一個收納盒。')).toBeVisible();
 await expect(page.getByLabel('你的問題')).toHaveValue('');
 await expect(log.locator('.advice-step')).toHaveCount(3);
 await expect(log.getByRole('button',{name:'下一步 →',exact:true})).toHaveCount(0);
 await log.getByRole('button',{name:'提出問題',exact:true}).click();
 await expect(page.getByLabel('你的問題')).toBeFocused();
 await page.getByLabel('你的問題').fill('沒有抽屜怎麼辦？');
 await send.click();
 await expect(log.locator('.bubble.user').last()).toContainText('沒有抽屜怎麼辦？');
 await expect(log.getByText('可以用現有的盒子分區，放在桌面角落，不需要另外購買。')).toBeVisible();
 await expect(log.getByRole('button',{name:'其他／自行輸入',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'送出訊息',exact:true})).toBeDisabled();
 expect(await log.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 const historyBox=await log.boundingBox(),composerBox=await page.locator('.ai-chat-composer').boundingBox();
 expect(composerBox!.y).toBeGreaterThanOrEqual(historyBox!.y+historyBox!.height-1);
 await page.getByLabel('你的問題').blur();
 await expect(page.getByRole('navigation',{name:'主要導覽'})).toBeVisible();
 await page.screenshot({path:'pwa-runtime/chat-messenger-'+test.info().project.name+'.png'});
});


test('inventory photo saves under owner folder, retries safely and keeps buttons separated', async ({page})=>{
 await login(page);let rows:any[]=[];let attempts=0;let uploadedPath='';let inserted:any;
 await page.context().route(/\/rest\/v1\/items/,async route=>{
  if(route.request().method()==='POST'){inserted=route.request().postDataJSON();rows=[{id:'photo-item',...inserted}];return route.fulfill({status:201,json:[]});}
  return route.fulfill({json:rows});
 });
 await page.context().route(/\/storage\/v1\//,async route=>{
  const request=route.request();const url=new URL(request.url());
  if(url.pathname.includes('/object/sign/'))return route.fulfill({json:{signedURL:'/object/sign/analysis-photos/test.jpg?token=test'}});
  if(request.method()==='POST'){
   attempts++;uploadedPath=decodeURIComponent(url.pathname.split('/object/analysis-photos/')[1]);
   expect(uploadedPath).toMatch(new RegExp('^'+user.id+'/items/.*\\.jpg$'));
   expect(request.headers()['content-type']).toContain('image/jpeg');
   expect(request.postDataBuffer()!.length).toBeGreaterThan(10);
   if(attempts===1)return route.fulfill({status:400,json:{statusCode:'400',error:'Error',message:'照片上傳失敗，請重試'}});
   return route.fulfill({json:{Key:'analysis-photos/'+uploadedPath}});
  }
  return route.fulfill({contentType:'image/png',body:readFileSync('web/public/icons/icon-192.png')});
 });
 await page.evaluate(()=>{location.hash='items';});
 await page.getByRole('button',{name:'＋ 新增物品'}).click();
 await page.getByLabel('物品名稱',{exact:true}).fill('照片鉛筆');
 await page.getByLabel('從相簿選擇',{exact:true}).setInputFiles('web/public/icons/icon-192.png');
 await expect(page.getByAltText('待提交的照片預覽')).toBeVisible();
 const picker=page.locator('.item-create-form .photo-picker'),actions=page.locator('.item-create-actions');
 const a=await picker.boundingBox(),b=await actions.boundingBox();expect(b!.y).toBeGreaterThanOrEqual(a!.y+a!.height+12);
 const form=page.locator('.item-create-form');
 expect(await form.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.getByRole('button',{name:'儲存物品',exact:true}).click();
 await expect(page.getByText('照片上傳失敗，請重試',{exact:true})).toBeVisible();
 expect(inserted).toBeUndefined();await expect(page.getByAltText('待提交的照片預覽')).toBeVisible();
 await page.screenshot({path:'pwa-runtime/item-photo-form-'+test.info().project.name+'.png'});
 await page.getByRole('button',{name:'儲存物品',exact:true}).click();
 await expect(page.getByRole('heading',{name:'照片鉛筆',exact:true})).toBeVisible();
 expect(inserted.image_path).toBe(uploadedPath);expect(attempts).toBe(2);
});


test('language switch persists, English navigation works and night colors are neutral',async({page})=>{
 await login(page);await page.evaluate(()=>{location.hash='settings'});
 await page.getByLabel('語言',{exact:true}).selectOption('en');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.getByLabel('Language',{exact:true})).toHaveValue('en');
 for(const name of ['Home','Items','Marketplace','Settings'])await expect(page.locator('nav').getByRole('button',{name,exact:true})).toBeVisible();
 await page.getByLabel('Dark Mode',{exact:true}).check();
 const colors=await page.evaluate(()=>['--bg','--card','--primary','--soft'].map(key=>getComputedStyle(document.documentElement).getPropertyValue(key).trim()));
 for(const color of colors){const hex=color.replace('#','');const channels=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));expect(channels[1]).toBeLessThanOrEqual(Math.max(channels[0],channels[2]));}
 await page.reload();await expect(page.getByLabel('Language',{exact:true})).toHaveValue('en');
 await page.locator('nav').getByRole('button',{name:'Home',exact:true}).click();
 await expect(page.locator('.home-brand-offset')).toBeVisible();
 await page.screenshot({path:'pwa-runtime/english-neutral-home-'+test.info().project.name+'.png'});
 await page.locator('nav').getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByLabel('Language',{exact:true}).selectOption('zh-TW');
 await expect(page.locator('html')).toHaveAttribute('lang','zh-TW');
 await expect(page.locator('nav').getByRole('button',{name:'首頁',exact:true})).toBeVisible();
});

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('sorti-permission-intro-v1','done'));});
