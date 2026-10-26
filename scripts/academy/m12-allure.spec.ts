// Modul 12: memperkaya laporan Allure dengan label, langkah, dan lampiran.
// Tanpa reporter allure-playwright, panggilan allure di bawah ini tidak berpengaruh apa-apa.
import { test, expect } from '../../fixtures';
import * as allure from 'allure-js-commons';

test('login customer tercatat rapi di Allure', { tag: '@smoke' }, async ({ loginPage, shopPage, page }) => {
  await allure.epic('TokoQA');
  await allure.feature('Login'); // fitur yang dites
  await allure.severity('critical'); // tingkat kepentingan

  await test.step('Buka halaman login', async () => { // langkah 1 tampil di report
    await loginPage.open();
  });
  await test.step('Login sebagai customer', async () => { // langkah 2
    await loginPage.login(process.env.TOKOQA_USERNAME!, process.env.TOKOQA_PASSWORD!);
  });
  await test.step('Sapaan muncul di toko', async () => { // langkah 3
    await expect(shopPage.greeting).toHaveText('Halo, Rina Wulandari');
  });

  await allure.attachment('Halaman toko setelah login', await page.screenshot(), 'image/png'); // lampirkan screenshot ke report
});