// Modul 3 — Script pertama versi test.
import { test, expect } from '@playwright/test'; // test = pembuat test, expect = pemeriksa hasil

test('buka halaman login', async ({ page }) => { // page disiapkan otomatis oleh Playwright Test
  await page.goto('/login-toko.html'); // buka halaman login (base URL + path)

  await expect(page).toHaveTitle('Login — TokoQA'); // judul tab harus persis ini
  await expect(page.getByRole('heading', { name: 'Masuk ke TokoQA' })).toBeVisible(); // judul form harus terlihat

  await page.screenshot({ path: 'test-results/m03-login.png' }); // simpan screenshot sebagai bukti
});