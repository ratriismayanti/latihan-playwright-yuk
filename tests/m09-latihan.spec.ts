import { test, expect } from '@playwright/test';
import fs from 'fs';
//import { nextOpenDay } from '../../pages/KlinikPage';
import { randomUUID } from 'node:crypto';

test('prompt dibatalkan', async ({ page }) => {
  await page.goto('/arena.html');
  page.once('dialog', (dialog) => dialog.dismiss()); // pasang penangan dulu: tekan Batal
  await page.getByRole('button', { name: 'Tampilkan prompt' }).click(); // munculkan prompt
  await expect(page.getByTestId('dialog-result')).toHaveText('Prompt dibatalkan'); // halaman mencatat prompt dibatalkan
});

test('iframe: email salah', async ({ page }) => {
  await page.goto('/arena.html');
  const newsletter = page.frameLocator('iframe[title="Formulir newsletter"]'); // masuk ke dalam iframe lewat judulnya
  await newsletter.getByLabel('Email').fill('rina-tanpa-at'); // email tanpa @
  await newsletter.getByRole('button', { name: 'Daftar' }).click(); // klik Daftar
  await expect(newsletter.getByRole('status')).toHaveText('Email tidak valid'); // pesan error dari dalam iframe
});

test('tab bantuan', async ({ page }) => {
  await page.goto('/arena.html');
  const tunggu = page.context().waitForEvent('page'); // pasang sebelum klik
  await page.getByRole('link', { name: 'Buka pusat bantuan' }).click(); // klik link yang membuka tab baru
  const bantuan = await tunggu; // tab barunya
  await expect(bantuan.getByRole('heading', { name: 'Pusat Bantuan' })).toBeVisible(); // isi tab baru terlihat
  expect(page.context().pages()).toHaveLength(2); // sekarang ada 2 tab

  // Tutup dari test, bukan lewat tombol "Tutup tab": tombol yang menutup halamannya sendiri
  // bisa memicu error "Target closed" di Firefox, karena halaman hilang saat klik belum selesai.
  await bantuan.close();
  expect(page.context().pages()).toHaveLength(1); // tinggal 1 tab
  await expect(page.getByRole('heading', { name: 'Arena latihan' })).toBeVisible(); // tab asal masih aman
});

test('isi unduhan', async ({ page }, testInfo) => {
  await page.goto('/arena.html');
  const tunggu = page.waitForEvent('download'); // pasang sebelum klik
  await page.getByRole('link', { name: 'Unduh laporan' }).click(); // klik link unduhan
  const unduhan = await tunggu; // unduhannya
  const laporan = testInfo.outputPath(unduhan.suggestedFilename());
  await unduhan.saveAs(laporan); // simpan file-nya

  const baris = fs.readFileSync(laporan, 'utf8').trim().split('\n'); // baca isi file per baris
  expect(baris).toHaveLength(3); // judul kolom + 2 data
  expect(baris[0]).toBe('id,produk,terjual'); // baris pertama = judul kolom
});

//test('batalkan janji temu lewat dialog', async ({ page }) => {
  //await page.goto('/login-klinik.html');
  //await page.getByLabel('Username').fill('pasien'); // isi Username
  //await page.getByLabel('Password').fill('sehat123'); // isi Password
  //await page.getByRole('button', { name: 'Masuk' }).click(); // klik Masuk
  //await expect(page.getByTestId('greeting')).toHaveText('Halo, Budi Santoso'); // sudah masuk

  // Siapkan janji temu lewat API, memakai token yang disimpan browser setelah login.
  //const token = await page.evaluate(() => localStorage.getItem('klinikqa_token'));
  //const res = await page.request.post('/api/klinik/appointments', { // buat janji temu lewat API dengan token dari browser
    //headers: { Authorization: `Bearer ${token}` },
    //data: { doctorId: 2, date: nextOpenDay(3), time: '09:30', complaint: 'Anak batuk sejak kemarin' },
  //});
  //const janji = (await res.json()).id; // nomor janji temu yang baru dibuat
  //await page.goto(`/klinik-detail.html?id=${janji}`); // buka detail janji temu itu

  //page.once('dialog', (dialog) => dialog.accept()); // tekan OK di confirm()
  //await page.getByRole('button', { name: 'Batalkan janji temu' }).click(); // klik Batalkan, dialog confirm muncul lalu diterima
  //await expect(page.getByTestId('appt-status')).toHaveText('Dibatalkan'); // statusnya jadi Dibatalkan
//});

test('terima pengembalian lewat modal', async ({ page }) => {
  // Siapkan data lewat API: perpustakaan baru, satu anggota, dan satu pinjaman
  const pustakawan = { username: `pustakawan-${randomUUID().slice(0, 6)}`, password: 'rahasia123' };
  await page.request.post('/api/perpus/libraries', { data: { name: 'Latihan modal', ...pustakawan } }); // buka perpustakaan baru
  const kunci = { Authorization: `Bearer ${(await (await page.request.post('/api/perpus/login', { data: pustakawan })).json()).token}` }; // header token pustakawan
  const rina = { username: `rina-${randomUUID().slice(0, 6)}`, password: 'baca123' }; // akun anggota acak
  await page.request.post('/api/perpus/members', { headers: kunci, data: { name: 'Rina', ...rina } }); // pustakawan mendaftarkan Rina
  const kunciRina = { Authorization: `Bearer ${(await (await page.request.post('/api/perpus/login', { data: rina })).json()).token}` }; // header token Rina
  const pinjam = await (await page.request.post('/api/perpus/loans', { headers: kunciRina, data: { bookId: 13 } })).json(); // Rina meminjam buku nomor 13

  // Login sebagai pustakawan lewat UI
  await page.goto('/login-perpus.html');
  await page.getByLabel('Username').fill(pustakawan.username); // isi Username pustakawan
  await page.getByLabel('Password').fill(pustakawan.password); // isi Password pustakawan
  await page.getByRole('button', { name: 'Masuk' }).click(); // klik Masuk

  await page.getByRole('button', { name: `Terima pengembalian ${pinjam.id}` }).click(); // tombol terima di baris pinjaman itu
  // Ini modal buatan sendiri (role="dialog"), BUKAN dialog bawaan browser: cari seperti elemen biasa
  const modal = page.getByRole('dialog', { name: 'Terima pengembalian?' });
  await expect(modal).toContainText('Tepat waktu, tanpa denda'); // isi modal menyebut tanpa denda
  await modal.getByRole('button', { name: 'Terima buku' }).click(); // konfirmasi di dalam modal

  await expect(modal).toBeHidden(); // modal tertutup
  await expect(page.getByTestId('loan-row').filter({ hasText: pinjam.id })).toHaveCount(0); // pinjaman itu hilang dari daftar aktif
});