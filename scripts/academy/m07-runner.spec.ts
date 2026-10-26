// Modul 7 — Test runner: hook, pola AAA, data-driven, tag.
import { test, expect } from '@playwright/test';

test.describe('Login TokoQA', () => {
  // Hook = persiapan yang dijalankan sebelum SETIAP test di grup ini
  test.beforeEach(async ({ page }) => {
    await page.goto('/login-toko.html');
  });

  test('login berhasil', { tag: '@smoke' }, async ({ page }) => {
    // Arrange — halaman login sudah dibuka oleh beforeEach

    // Act — lakukan aksi yang mau dites
    await page.getByLabel('Username').fill('customer');
    await page.getByLabel('Password').fill('rahasia123'); // isi Password
    await page.getByRole('button', { name: 'Masuk' }).click(); // klik Masuk

    // Assert — pastikan hasilnya sesuai harapan
    await expect(page).toHaveURL(/shop\.html$/);
    await expect(page.getByTestId('greeting')).toHaveText('Halo, Rina Wulandari'); // sapaan menyebut nama customer
  });

  const kasusGagal = [ // tabel data: satu baris = satu test
    { judul: 'password salah', username: 'customer', password: 'salah', pesan: 'Username atau password salah' },
    { judul: 'akun terkunci', username: 'terkunci', password: 'rahasia123', pesan: 'Akun kamu terkunci. Hubungi admin.' },
    { judul: 'form kosong', username: '', password: '', pesan: 'Username dan password wajib diisi' },
  ];

  for (const { judul, username, password, pesan } of kasusGagal) { // buat satu test untuk setiap baris data
    test(`login gagal: ${judul}`, async ({ page }) => {
      await page.getByLabel('Username').fill(username);
      await page.getByLabel('Password').fill(password); // password dari baris data
      await page.getByRole('button', { name: 'Masuk' }).click(); // klik Masuk
      await expect(page.getByRole('alert')).toHaveText(pesan); // pesan error sesuai baris data
    });
  }
});