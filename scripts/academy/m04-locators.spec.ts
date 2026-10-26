// Modul 4 — Locator: cara Playwright menemukan elemen.
import { test, expect } from '@playwright/test'; // test = pembuat test, expect = pemeriksa hasil

const LOGIN = '/login-toko.html'; // halaman login TokoQA
const ARENA = '/arena.html'; // halaman latihan interaksi

test('getByRole', async ({ page }) => {
  await page.goto(LOGIN); // buka halaman login
  // Cari elemen seperti pengguna melihatnya: "sebuah heading bertuliskan ..."
  await expect(page.getByRole('heading', { name: 'Masuk ke TokoQA' })).toBeVisible(); // judul form terlihat
  await expect(page.getByRole('button', { name: 'Masuk' })).toBeEnabled(); // tombol Masuk bisa diklik
});

test('label, placeholder, test id', async ({ page }) => {
  await page.goto(LOGIN); // buka halaman login
  await page.getByLabel('Username').fill('customer'); // cari lewat teks label
  await page.getByPlaceholder('••••••••').fill('rahasia123'); // cari lewat teks contoh di dalam kolom
  await expect(page.getByTestId('login-button')).toHaveText('Masuk'); // cari lewat atribut data-testid
});

test('getByText dan CSS', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  await expect(page.getByText('Klik kanan di sini')).toBeVisible(); // cari lewat teks yang terlihat
  // CSS selector: boleh, tapi jadikan pilihan terakhir
  await expect(page.locator('#students tr')).toHaveCount(5); // semua baris di tabel ber-id students
});

test('filter dan chaining', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  // Baris tabel yang mengandung "Citra" → di dalamnya, tombol "Detail"
  const barisCitra = page.getByRole('row').filter({ hasText: 'Citra' }); // saring baris yang berisi "Citra"
  await barisCitra.getByRole('button', { name: 'Detail' }).click(); // cari tombol Detail hanya di baris itu
  await expect(page.getByTestId('table-result')).toHaveText('Detail: Citra'); // hasilnya menyebut Citra
});

test('nth, first, last', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  const buah = page.getByTestId('fruit'); // satu locator untuk beberapa elemen
  await expect(buah).toHaveCount(3); // ada 3 buah
  await expect(buah.first()).toHaveText('Apel'); // elemen pertama
  await expect(buah.nth(1)).toHaveText('Jeruk'); // index mulai dari 0, jadi nth(1) = elemen kedua
  await expect(buah.last()).toHaveText('Mangga'); // elemen terakhir
});

test('strict mode', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  // "Tampilkan" cocok dengan 3 tombol. Kalau kita .click() langsung → error strict mode.
  const tombol = page.getByRole('button', { name: 'Tampilkan' }); // name mencocokkan sebagian teks
  await expect(tombol).toHaveCount(3); // buktinya: ada 3 tombol yang cocok
  // Solusi: perjelas locatornya
  await expect(page.getByRole('button', { name: 'Tampilkan confirm' })).toHaveCount(1); // tinggal 1 yang cocok
});


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