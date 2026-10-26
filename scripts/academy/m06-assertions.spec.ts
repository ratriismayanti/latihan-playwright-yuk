// Modul 6 — Assertion & auto-waiting.
import { test, expect } from '@playwright/test'; // test = pembuat test, expect = pemeriksa hasil

const LOGIN = '/login-toko.html'; // halaman login TokoQA
const ARENA = '/arena.html'; // halaman latihan interaksi

test('berbagai assertion', async ({ page }) => {
  await page.goto(LOGIN); // buka halaman login TokoQA
  await expect(page).toHaveURL(/login-toko\.html$/); // URL berakhiran login-toko.html
  await expect(page).toHaveTitle(/TokoQA/); // judul tab mengandung TokoQA

  const username = page.getByLabel('Username'); // kolom Username
  await expect(username).toBeEmpty(); // masih kosong
  await expect(username).toHaveAttribute('placeholder', 'contoh: customer'); // teks contoh di dalam kolom
  await username.fill('customer'); // isi Username
  await expect(username).toHaveValue('customer'); // isinya customer

  await expect(page.getByRole('alert')).toBeHidden(); // belum ada pesan error
  await expect(page.getByRole('button', { name: 'Masuk' })).toContainText('Mas'); // cukup mengandung sebagian teks
});

test('auto-wait konten dinamis', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  await page.getByRole('button', { name: 'Muat data' }).click(); // data dimuat 1,5 detik kemudian
  // Data baru muncul setelah 1,5 detik. Tidak perlu sleep — expect menunggu sendiri.
  await expect(page.getByText('Data berhasil dimuat')).toBeVisible(); // expect menunggu sampai teks ini muncul
  await expect(page.getByTestId('loaded-list').getByRole('listitem')).toHaveCount(3); // ada 3 butir data
});

test('tombol yang aktif belakangan', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  const tombol = page.getByRole('button', { name: 'Proses' }); // tombol yang aktif setelah ±2 detik
  await expect(tombol).toBeDisabled(); // awalnya belum bisa diklik
  await expect(tombol).toBeEnabled(); // menunggu sampai ±2 detik
  await tombol.click(); // klik setelah aktif
  await expect(page.getByTestId('late-result')).toHaveText('Diproses!'); // hasilnya muncul
});

test('negasi dan timeout khusus', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  await page.getByRole('button', { name: 'Simpan' }).click(); // munculkan toast
  const toast = page.getByText('Data tersimpan'); // notifikasi sementara
  await expect(toast).toBeVisible(); // toast terlihat
  await expect(toast).not.toBeVisible({ timeout: 6000 }); // toast hilang setelah 3 detik
});

test('soft assertion: lanjut walau ada yang gagal', async ({ page }) => {
  await page.goto(LOGIN); // buka halaman login TokoQA
  // expect.soft mencatat kegagalan tapi test tetap jalan sampai akhir
  await expect.soft(page).toHaveTitle('Login — TokoQA'); // dicatat kalau gagal, test tetap lanjut
  await expect.soft(page.getByLabel('Username')).toBeVisible(); // kolom Username terlihat
  await expect.soft(page.getByLabel('Password')).toBeVisible(); // kolom Password terlihat
});

test('progress sampai selesai', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  await page.getByRole('button', { name: 'Mulai unduh' }).click(); // mulai progress bar
  await expect(page.getByTestId('prog-text')).toHaveText('Selesai'); // tunggu sampai tulisannya Selesai
  await expect(page.getByLabel('Progress unduhan')).toHaveAttribute('value', '100'); // nilai progress bar 100
});