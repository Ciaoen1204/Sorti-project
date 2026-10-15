import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });
test('installed app shell opens offline without caching private API data', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Service-worker network emulation runs in Chromium; WebKit UI has separate coverage.',
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '讓生活，回到喜歡的樣子' })).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      { timeout: 20000 },
    )
    .toBeTruthy();
  const urls = await page.evaluate(async () => {
    const cachesList = await caches.keys();
    const cache = await caches.open(
      cachesList.find(name => name.startsWith('sorti-shell-'))!,
    );
    return (await cache.keys()).map(request => request.url);
  });
  expect(
    urls.some(url => url.includes('/api/') || url.includes('supabase.co')),
  ).toBeFalsy();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '讓生活，回到喜歡的樣子' })).toBeVisible();
  await expect(page.getByAltText('拾序 熊抱收納盒 Logo')).toBeVisible();
});

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('sorti-permission-intro-v1','done'));});
