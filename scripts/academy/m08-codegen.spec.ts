// Modul 8 — Hasil rekaman codegen yang sudah dirapikan (pola AAA + assertion).
import { test, expect } from '@playwright/test';

test('tambah produk ke keranjang', async ({ page }) => {
  // Arrange: login
  await page.goto('/login-toko.html');
  await page.getByLabel('Username').fill('customer'); // isi Username
  await page.getByLabel('Password').fill('rahasia123'); // isi Password
  await page.getByRole('button', { name: 'Masuk' }).click(); // klik Masuk

  // Act: tambahkan Mouse Wireless
  const kartu = page.getByTestId('product-card').filter({ hasText: 'Mouse Wireless' });
  await kartu.getByRole('button', { name: 'Tambah ke keranjang' }).click(); // tombol tambah di kartu Mouse Wireless

  // Assert: keranjang berisi 1 item yang benar
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await expect(page.getByTestId('cart-item')).toContainText('Mouse Wireless'); // keranjang berisi Mouse Wireless
});