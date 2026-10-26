// Modul 5 — Interaksi: klik, ketik, pilih, hover, upload, drag & drop.
import { test, expect } from '@playwright/test'; // test = pembuat test, expect = pemeriksa hasil

const ARENA = '/arena.html'; // halaman latihan interaksi

// Dijalankan sebelum setiap test di file ini: semua test mulai dari Arena
test.beforeEach(async ({ page }) => {
  await page.goto(ARENA);
});

test('klik, double klik, klik kanan', async ({ page }) => {
  const tombol = page.getByRole('button', { name: 'Klik aku' }); // simpan locator supaya bisa dipakai berulang
  await tombol.click(); // klik pertama
  await tombol.click(); // klik kedua
  await tombol.click(); // klik ketiga
  await expect(page.getByTestId('click-count')).toHaveText('3'); // penghitung menunjukkan 3

  await page.getByRole('button', { name: 'Klik dua kali' }).dblclick(); // klik dua kali cepat
  await expect(page.getByTestId('dbl-result')).toHaveText('Double click terdeteksi!'); // pesan double click muncul

  await page.getByText('Klik kanan di sini').click({ button: 'right' }); // klik kanan
  await expect(page.getByTestId('ctx-result')).toHaveText('Menu konteks dibuka'); // menu konteks terbuka
});

test('isi formulir lengkap', async ({ page }) => {
  await page.getByLabel('Nama lengkap').fill('Rina'); // kolom teks satu baris
  await page.getByLabel('Catatan').fill('Belajar Playwright itu seru!'); // kolom teks banyak baris
  await page.getByLabel('Menengah').check(); // pilih radio button
  await page.getByLabel('Bahasa favorit').selectOption('python'); // pilih satu opsi dropdown
  await page.getByLabel('Browser yang dites').selectOption(['Chromium', 'WebKit']); // pilih beberapa opsi sekaligus
  await page.getByLabel('Tanggal mulai').fill('2026-10-04'); // kolom tanggal diisi format YYYY-MM-DD
  await page.getByLabel('Berlangganan newsletter').check(); // centang checkbox

  await page.getByRole('button', { name: 'Kirim formulir' }).click(); // kirim form

  // Ringkasan hasil kiriman harus memuat semua isian tadi
  await expect(page.getByTestId('form-result')).toHaveText(
    'Terkirim: Rina | level Menengah | bahasa python | browser Chromium, WebKit | newsletter ya',
  );
});

test('hover', async ({ page }) => {
  await page.getByRole('button', { name: 'Arahkan ke sini' }).hover(); // arahkan kursor tanpa klik
  await expect(page.getByRole('tooltip')).toHaveText('Halo dari tooltip! 👋'); // tooltip muncul

  await page.getByRole('button', { name: 'Menu Produk' }).hover(); // buka menu yang muncul saat hover
  await expect(page.getByRole('link', { name: 'Furnitur' })).toBeVisible(); // isi menunya terlihat
});

test('keyboard', async ({ page }) => {
  const kotak = page.getByLabel('Ketik di sini'); // kolom latihan keyboard
  await kotak.pressSequentially('halo'); // mengetik huruf per huruf seperti manusia
  await expect(kotak).toHaveValue('halo'); // isi kolomnya "halo"

  await kotak.press('Enter'); // tekan satu tombol
  await expect(page.getByTestId('last-key')).toHaveText('Enter'); // halaman mencatat tombol terakhir

  await kotak.press('Shift+ArrowLeft'); // kombinasi tombol ditulis dengan tanda +
  await expect(page.getByTestId('last-key')).toHaveText('Shift+ArrowLeft'); // tercatat kombinasinya
});

test('upload file', async ({ page }) => {
  // File bisa dibuat langsung di memori, tanpa file fisik
  await page.getByLabel('Pilih file').setInputFiles({
    name: 'laporan.txt', // nama file yang terlihat oleh halaman
    mimeType: 'text/plain', // jenis file
    buffer: Buffer.from('isi laporan'), // isi file
  });
  await expect(page.getByTestId('upload-result')).toHaveText('File terpilih: laporan.txt'); // nama file tampil
});

test('drag and drop', async ({ page }) => {
  await page.getByText('Apel', { exact: true }).dragTo(page.getByTestId('basket')); // seret Apel ke keranjang
  await expect(page.getByTestId('drag-result')).toHaveText('Isi keranjang: Apel'); // Apel masuk keranjang
});