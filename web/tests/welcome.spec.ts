import {test, expect} from '@playwright/test';
test('welcome opens login and registration without overflow', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'讓生活，回到喜歡的樣子'})).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await expect(page.locator('.welcome-hero .brand img')).toHaveCSS('width','200px');
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.getByText('還沒註冊帳號嗎？')).toBeVisible();
  await page.getByRole('button',{name:'請先完成帳號註冊'}).click();
  await expect(page.locator('input[name="confirm"]')).toBeVisible();
  await page.locator('input[name="name"]').fill('測試');
  await expect(page.locator('input[name="name"]')).toHaveCSS('outline-style','none');
  await expect(page.locator('input[name="name"]').locator('..')).toHaveCSS('outline-style','solid');
  await expect(page.getByText('✓ 密碼至少 8 個字元')).toBeVisible();
  await page.getByRole('button',{name:'顯示密碼',exact:true}).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'隱藏密碼',exact:true}).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute('type','password');
  await page.getByRole('button',{name:'返回歡迎頁'}).click();
  await page.getByRole('button',{name:'註冊',exact:true}).click();
  await expect(page.locator('input[name="confirm"]')).toBeVisible();
  await page.screenshot({path:'pwa-runtime/auth-register-'+test.info().project.name+'.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('sorti-permission-intro-v1','done'));});
