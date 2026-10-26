import { test, expect } from '@playwright/test'; // test = pembuat test, expect = pemeriksa hasil

// Satu test bernama "halaman login terbuka". page = satu tab browser, disiapkan otomatis
test('halaman login terbuka', async ({ page }) => {
  await page.goto('/login-toko.html'); // buka halaman login (base URL + path ini)
  await expect(page).toHaveTitle(/TokoQA/); // judul tab harus mengandung "TokoQA"
  await expect(page.getByRole('button', { name: 'Masuk' })).toBeVisible(); // tombol Masuk harus terlihat
});