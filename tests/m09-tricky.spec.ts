// Modul 9 — Situasi tricky: dialog, iframe, tab baru, download, tabel.
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { // semua test mulai dari Arena
  await page.goto('/arena.html');
});

test('alert diterima', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Tampilkan alert' }).click(); // munculkan alert
  await expect(page.getByTestId('dialog-result')).toHaveText('Alert ditutup'); // halaman mencatat alert sudah ditutup
});

test('confirm default ditolak', async ({ page }) => {
  // Tanpa handler, Playwright otomatis menekan "Batal" (dismiss)
  await page.getByRole('button', { name: 'Tampilkan confirm' }).click();
  await expect(page.getByTestId('dialog-result')).toHaveText('Kamu memilih: Batal'); // confirm ditolak (Batal)
});

test('prompt diisi', async ({ page }) => {
  const pesan: string[] = [];
  page.once('dialog', async (dialog) => { // pasang penangan SEBELUM dialog muncul
    pesan.push(dialog.message());
    await dialog.accept('Rina'); // isi jawaban lalu tekan OK
  });
  await page.getByRole('button', { name: 'Tampilkan prompt' }).click(); // munculkan prompt

  await expect(page.getByTestId('dialog-result')).toHaveText('Halo, Rina!'); // halaman memakai jawaban tadi
  expect(pesan).toEqual(['Siapa namamu?']); // teks pertanyaannya sesuai
});

test('iframe', async ({ page }) => {
  const frame = page.frameLocator('iframe[title="Formulir newsletter"]');
  await frame.getByLabel('Email').fill('rina@contoh.com'); // isi Email di dalam iframe
  await frame.getByRole('button', { name: 'Daftar' }).click(); // klik Daftar di dalam iframe
  await expect(frame.getByRole('status')).toHaveText('Terdaftar: rina@contoh.com'); // konfirmasi muncul di dalam iframe
});

test('tab baru', async ({ page }) => {
  // Mulai "menunggu" tab baru SEBELUM klik, lalu klik
  const tabBaruPromise = page.context().waitForEvent('page');
  await page.getByRole('link', { name: 'Buka pusat bantuan' }).click(); // klik link yang membuka tab baru
  const tabBaru = await tabBaruPromise; // tab barunya

  await expect(tabBaru).toHaveTitle('Pusat Bantuan — Arena'); // judul tab baru
  await expect(tabBaru.getByRole('heading', { name: 'Pusat Bantuan' })).toBeVisible(); // isi tab baru terlihat
});

test('download', async ({ page }, testInfo) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Unduh laporan' }).click(); // klik link unduhan
  const download = await downloadPromise; // unduhannya

  expect(download.suggestedFilename()).toBe('laporan.csv'); // nama file yang disarankan server
  const tujuan = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(tujuan); // simpan file-nya
  expect(await readFile(tujuan, 'utf-8')).toContain('Keyboard Mekanik'); // isi file benar
});

test('tabel', async ({ page }) => {
  const baris = page.locator('#students').getByRole('row');

  await page.getByRole('button', { name: 'Urutkan nilai tertinggi' }).click(); // urutkan tabel
  await expect(baris.first()).toContainText('Citra'); // baris pertama sekarang Citra
  await expect(baris.filter({ hasText: 'Remedial' })).toHaveCount(2); // 2 siswa berstatus Remedial

  const nama = await page.locator('#students tr td:first-child').allInnerTexts(); // ambil teks semua sel nama sekaligus
  expect(nama).toEqual(['Citra', 'Dewi', 'Andi', 'Eko', 'Budi']); // urutan nama dari nilai tertinggi
});