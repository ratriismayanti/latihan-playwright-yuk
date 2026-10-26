import { test, expect } from '@playwright/test'; // test = pembuat test, expect = pemeriksa hasil


test('login, cari mouse, lalu screenshot', async ({ page }, testInfo) => { // testInfo = info tentang test yang sedang jalan
  await page.goto('/login-toko.html'); // buka halaman login
  await page.getByLabel('Username').fill('customer'); // isi Username
  await page.getByLabel('Password').fill('rahasia123'); // isi Password
  await page.getByRole('button', { name: 'Masuk' }).click(); // klik Masuk, pindah ke toko

  await page.getByLabel('Cari produk').fill('mouse'); // ketik di kolom pencarian
  await expect(page.getByTestId('product-card')).toHaveCount(1); // tinggal 1 kartu produk

  const gambar = testInfo.outputPath('m03-cari.png'); // path file di folder output milik test ini
  await page.screenshot({ path: gambar }); // simpan screenshot
});

test('judul halaman toko', async ({ page }) => {
  await page.goto('/login-toko.html'); // buka halaman login
  console.log('Judul halaman:', await page.title()); // cetak judul ke terminal
  await expect(page).toHaveTitle('Login — TokoQA'); // judul harus persis ini
});