import { test, expect } from '@playwright/test'; // test = pembuat test, expect = pemeriksa hasil


test('locator di toko', async ({ page }) => {
  await page.goto('/login-toko.html'); // buka halaman login
  await page.getByLabel('Username').fill('customer'); // isi Username
  await page.getByLabel('Password').fill('rahasia123'); // isi Password
  await page.getByRole('button', { name: 'Masuk' }).click(); // masuk ke toko

  const cari = page.getByLabel('Cari produk');                // kolom pencarian
  const kategori = page.getByLabel('Kategori');               // dropdown
  const jumlahKeranjang = page.getByTestId('cart-count');     // angka di ikon keranjang
  const tambahHeadset = page // tombol tambah di kartu Headset Gaming
    .getByTestId('product-card')                              // semua kartu produk
    .filter({ hasText: 'Headset Gaming' })                    // hanya kartu Headset Gaming
    .getByRole('button', { name: 'Tambah ke keranjang' });    // tombol di dalam kartu itu

  await tambahHeadset.click(); // tambah headset ke keranjang
  await expect(jumlahKeranjang).toHaveText('1'); // angka keranjang jadi 1
  await kategori.selectOption('Furnitur'); // pilih kategori Furnitur
  await expect(page.getByTestId('product-card')).toHaveCount(2); // tersisa 2 produk furnitur
  await cari.fill('meja'); // cari "meja"
  
  await expect(page.getByTestId('product-card')).toHaveCount(1); // tersisa 1 produk
});


test('strict mode dan cara memperbaikinya', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const semuaDetail = page.getByRole('button', { name: 'Detail' }); // locator yang terlalu umum
  await expect(semuaDetail).toHaveCount(5); // ada 5 tombol "Detail", satu per baris

  // Terlalu umum: Playwright menolak menebak tombol mana yang dimaksud.
  // rejects.toThrow = test lulus kalau klik ini gagal dengan pesan strict mode violation
  await expect(semuaDetail.click({ timeout: 2000 })).rejects.toThrow(/strict mode violation/);

  // Perbaikan: persempit ke baris milik Dewi dulu
  await page.getByRole('row').filter({ hasText: 'Dewi' }).getByRole('button', { name: 'Detail' }).click();
  await expect(page.getByTestId('table-result')).toHaveText('Detail: Dewi'); // yang terbuka detail Dewi
});

test('tabel siswa', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const baris = page.locator('#students').getByRole('row'); // semua baris di tabel siswa

  await expect(baris.filter({ hasText: 'Remedial' })).toHaveCount(2); // 2 baris berstatus Remedial
  await baris.filter({ hasText: 'Budi' }).getByRole('button', { name: 'Detail' }).click(); // klik Detail di baris Budi
  await expect(page.getByTestId('table-result')).toHaveText('Detail: Budi'); // yang terbuka detail Budi
});
