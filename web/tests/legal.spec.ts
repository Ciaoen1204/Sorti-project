import { test, expect, type Page } from '@playwright/test';
import policies from '../../src/data/legalPolicies.json';
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  email: 'legal-test@example.com',
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
const session = {
  access_token: token,
  refresh_token: 'test-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
};
async function mock(
  page: Page,
  read: () => boolean,
  save: (body: any) => boolean,
) {
  await page
    .context()
    .route(/\/auth\/v1\//, r =>
      r.fulfill({
        json:
          r.request().url().includes('/token') ||
          r.request().url().includes('/signup')
            ? session
            : user,
      }),
    );
  await page.context().route(/\/rest\/v1\//, r => {
    const url = r.request().url();
    if (url.includes('has_current_legal_acceptance'))
      return r.fulfill({ json: read() });
    if (url.includes('accept_current_policies'))
      return save(r.request().postDataJSON())
        ? r.fulfill({ json: null })
        : r.fulfill({ status: 503, json: { message: 'unavailable' } });
    return r.fulfill({ json: url.includes('user_personas') ? null : [] });
  });
}
async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await page.getByLabel('電子信箱').fill(user.email);
  await page.getByLabel('密碼', { exact: true }).fill('password123');
  await page.getByRole('button', { name: '登入', exact: true }).click();
}
async function confirmDocuments(page:Page){
 for(const name of ['服務條款','隱私權政策']){
  await page.getByRole('link',{name,exact:true}).tap();
  await expect(page.locator('.legal-page h1')).toContainText(name);
  await page.getByRole('button',{name:'滑到底部 ↓',exact:true}).tap();
  await page.locator('.policy-review').getByRole('checkbox').check();
  await page.getByRole('button',{name:'確認並返回',exact:true}).tap();
 }
}
test('public full policies preserve every block and PDF URLs', async ({
  page,
}) => {
  for (const kind of ['terms', 'privacy'] as const) {
    await page.goto('/legal/' + kind);
    await expect(page.locator('.legal-page h1')).toHaveText(
      policies[kind].title + ' v1.1',
    );
    for (const block of policies[kind].blocks)
      await expect(page.locator('.legal-page')).toContainText(block);
    for (const url of policies[kind].links)
      await expect(
        page.locator('.legal-page a[href="' + url + '"]'),
      ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: 'pwa-runtime/legal-privacy-' + test.info().project.name + '.png',
    fullPage: true,
  });
  await page.screenshot({path:'pwa-runtime/legal-privacy-viewport-'+test.info().project.name+'.png'});
});
test('registration starts unchecked and policy return preserves input', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '註冊', exact: true }).click();
  await page.locator('input[name=name]').fill('測試暱稱');
  await page.locator('input[name=email]').fill(user.email);
  expect(
    await page
      .getByRole('checkbox')
      .evaluateAll(inputs =>
        inputs.every(input => !(input as HTMLInputElement).checked),
      ),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: '建立帳號', exact: true }),
  ).toBeDisabled();
  await page.getByRole('link', { name: '服務條款', exact: true }).click();
  await expect(page.locator('.legal-page h1')).toBeVisible();
  await page
    .locator('.legal-page')
    .getByRole('button', { name: '‹ 返回' })
    .click();
  await expect(page.locator('input[name=name]')).toHaveValue('測試暱稱');
  await expect(page.locator('input[name=email]')).toHaveValue(user.email);
});
test('save failure stays gated and successful server record opens service', async ({
  page,
}) => {
  let accepted = false,
    fail = true,
    saved: any;
  await mock(
    page,
    () => accepted,
    body => {
      saved = body;
      if (fail) return false;
      accepted = true;
      return true;
    },
  );
  await login(page);
  await expect(
    page.getByRole('heading', { name: '使用拾序前，請先確認' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '確認並繼續' })).toBeDisabled();
  await page.getByRole('checkbox').nth(0).check();
  await confirmDocuments(page);
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: '確認並繼續' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: '確認紀錄未保存' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '收納魔法學院' })).toHaveCount(
    0,
  );
  expect(saved).toEqual({
    p_terms_version: 'v1.1',
    p_privacy_version: 'v1.1',
    p_adult: true,
    p_agreed: true,
  });
  fail = false;
  await page.getByRole('button', { name: '確認並繼續' }).click();
  await expect(
    page.getByRole('heading', { name: '收納魔法學院' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '收納魔法學院' }),
  ).toBeVisible();
});
for (const callback of [false, true])
  test(
    (callback ? 'Google callback' : 'restored existing user') +
      ' missing consent cannot bypass gate',
    async ({ page }) => {
      await mock(
        page,
        () => false,
        () => false,
      );
      await page.addInitScript(
        value =>
          localStorage.setItem(
            'sb-riqpljtpfcwuejvoyfoh-auth-token',
            JSON.stringify(value),
          ),
        session,
      );
      await page.goto(callback ? '/?auth_callback=google' : '/#items');
      await expect(
        page.getByRole('heading', { name: '使用拾序前，請先確認' }),
      ).toBeVisible();
      await expect(page.getByRole('checkbox').nth(0)).not.toBeChecked();
      await expect(page.getByRole('checkbox').nth(1)).not.toBeChecked();
      await expect(page.locator('.bottom-nav')).toHaveCount(0);
      await page.getByRole('link', { name: '隱私權政策' }).click();
      await expect(page.locator('.legal-page')).toContainText('7.5');
    },
  );
test('contact supports mail and copy without reporting a deletion request', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          (window as any).copied = text;
        },
      },
    }),
  );
  await page.goto('/legal/contact');
  await expect(
    page.getByText(
      '如需服務協助、問題回報，或申請刪除帳號及個人資料，請寄信至 amanda.pan1204@gmail.com。',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: '開啟郵件程式' }),
  ).toHaveAttribute('href', 'mailto:amanda.pan1204@gmail.com');
  await page.getByRole('button', { name: '複製 Email 地址' }).click();
  await expect(page.getByRole('status')).toHaveText('已複製 Email 地址。');
  expect(await page.evaluate(() => (window as any).copied)).toBe(
    'amanda.pan1204@gmail.com',
  );
});

test('email registration records checked consent before opening service', async ({
  page,
}) => {
  let accepted = false;
  let calls = 0;
  await mock(
    page,
    () => accepted,
    body => {
      expect(body.p_adult).toBe(true);
      expect(body.p_agreed).toBe(true);
      calls++;
      accepted = true;
      return true;
    },
  );
  await page.goto('/');
  await page.getByRole('button', { name: '註冊', exact: true }).click();
  await page.locator('input[name=name]').fill('測試');
  await page.locator('input[name=username]').fill('invited');
  await page.locator('input[name=email]').fill(user.email);
  await page.locator('input[name=password]').fill('password123');
  await page.locator('input[name=confirm]').fill('password123');
  await page.getByRole('checkbox').nth(0).check();
  await confirmDocuments(page);
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: '建立帳號', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '收納魔法學院' }),
  ).toBeVisible();
  expect(calls).toBe(1);
});
test('server read failure remains gated with logout and public policies', async ({
  page,
}) => {
  await mock(
    page,
    () => false,
    () => false,
  );
  await page
    .context()
    .route(/has_current_legal_acceptance/, r =>
      r.fulfill({ status: 503, json: { message: 'offline' } }),
    );
  await login(page);
  await expect(
    page.getByRole('heading', { name: '使用拾序前，請先確認' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '登出帳號' })).toBeVisible();
  await expect(page.getByRole('button', { name: '確認並繼續' })).toBeDisabled();
});

test('a second device reads server acceptance and settings has contact without deletion menu',async({page,browser})=>{
 let accepted=true;await mock(page,()=>accepted,()=>true);await login(page);await expect(page.getByRole('heading',{name:'收納魔法學院'})).toBeVisible();
 await page.evaluate(()=>location.hash='settings');await expect(page.getByRole('link',{name:'服務條款',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'隱私權政策',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'聯絡我們',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'加入 Android 主畫面'})).toBeVisible();await expect(page.getByRole('button',{name:'申請刪除帳號與資料',exact:true})).toHaveCount(0);
 const context=await browser.newContext();const second=await context.newPage();await mock(second,()=>accepted,()=>true);await login(second);await expect(second.getByRole('heading',{name:'收納魔法學院'})).toBeVisible();await expect(second.getByRole('heading',{name:'使用拾序前，請先確認'})).toHaveCount(0);await context.close();
});

test('policy quick jump never auto-agrees and both document checks return to the original form',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'註冊',exact:true}).click();await page.locator('input[name=name]').fill('保留暱稱');
 const agreement=page.getByRole('checkbox',{name:'我同意服務條款，並已閱讀隱私權政策。'});
 const google=page.getByRole('button',{name:'使用 Google 帳號註冊',exact:true});
 expect(await google.evaluate(el=>el.getBoundingClientRect().top < document.querySelector('.legal-checks')!.getBoundingClientRect().top)).toBe(true);
 for(const kind of ['服務條款','隱私權政策']){
  await page.getByRole('link',{name:kind,exact:true}).click();
  await page.getByRole('button',{name:'滑到底部 ↓',exact:true}).click();
  const review=page.locator('.policy-review');await expect(review).toBeInViewport();
  await expect(review.getByRole('checkbox')).not.toBeChecked();await expect(review.getByRole('button',{name:'確認並返回'})).toBeDisabled();
  await review.getByRole('checkbox').check();await review.getByRole('button',{name:'確認並返回'}).click();
  await expect(page.locator('input[name=name]')).toHaveValue('保留暱稱');
  if(kind==='服務條款')await expect(agreement).not.toBeChecked();
 }
 await expect(agreement).not.toBeChecked();
 await expect(agreement).toBeEnabled();
 await agreement.check();await expect(page.getByRole('checkbox',{name:'我確認已年滿 18 歲。'})).not.toBeChecked();
 await page.screenshot({path:'pwa-runtime/legal-registration-compact-'+test.info().project.name+'.png',fullPage:true});
});

test('checking a document then backing out does not count as confirmation',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'註冊',exact:true}).click();
 const agree=page.getByRole('checkbox',{name:'我同意服務條款，並已閱讀隱私權政策。'});
 await expect(agree).toBeDisabled();await page.getByRole('link',{name:'服務條款',exact:true}).tap();
 await page.getByRole('button',{name:'滑到底部 ↓',exact:true}).tap();await page.locator('.policy-review').getByRole('checkbox').check();
 await page.locator('.legal-page').getByRole('button',{name:'‹ 返回'}).tap();await expect(agree).toBeDisabled();
 await confirmDocuments(page);await expect(agree).toBeEnabled();await expect(agree).not.toBeChecked();
});

test('consent checkboxes stay square and copy stays in one aligned row',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'註冊',exact:true}).click();
 for(const width of [360,390,414]){await page.setViewportSize({width,height:844});
 const dimensions=await page.locator('.legal-checks input[type=checkbox]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height};}));for(const box of dimensions)expect(Math.abs(box.w-box.h)).toBeLessThan(1);
 const row=await page.locator('.legal-agreement').evaluate(n=>{const box=n.querySelector('input')!.getBoundingClientRect(),text=n.querySelector('span')!.getBoundingClientRect();return {center:Math.abs((box.top+box.height/2)-(text.top+text.height/2)),height:text.height,overflow:n.querySelector('span')!.scrollWidth>n.querySelector('span')!.clientWidth};});expect(row.center).toBeLessThan(2);expect(row.height).toBeLessThan(27);expect(row.overflow).toBe(false);
 }await page.screenshot({path:'pwa-runtime/consent-square-'+test.info().project.name+'.png',fullPage:true});
});

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('sorti-permission-intro-v1','done'));});
