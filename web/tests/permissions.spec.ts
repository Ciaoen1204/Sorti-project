import {test,expect} from '@playwright/test';
test('first launch asks notification then camera and can defer without recurring',async({page})=>{
 await page.goto('/');const dialog=page.getByRole('dialog',{name:'首次權限設定'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('heading')).toHaveText('允許通知');await dialog.getByRole('button',{name:'稍後再說'}).click();await expect(dialog.getByRole('heading')).toHaveText('允許使用相機');await dialog.getByRole('button',{name:'稍後再說'}).click();await expect(dialog).toHaveCount(0);await page.reload();await expect(dialog).toHaveCount(0);await expect(page.getByRole('heading',{name:'讓生活，回到喜歡的樣子'})).toBeVisible();
});
