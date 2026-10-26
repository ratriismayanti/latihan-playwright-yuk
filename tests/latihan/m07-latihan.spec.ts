import { test, expect } from '@playwright/test';


const kasusLoginGagal = [
  { judul: 'password salah', username: 'customer', password: 'salah', pesan: 'Username atau password salah' },
  { judul: 'akun terkunci', username: 'terkunci', password: 'rahasia123', pesan: 'Akun kamu terkunci. Hubungi admin.' },
  { judul: 'form kosong', username: '', password: '', pesan: 'Username dan password wajib diisi' },
  { judul: 'admin password salah', username: 'admin', password: 'salah', pesan: 'Username atau password salah' }, // kasus baru
];

for (const k of kasusLoginGagal) { // buat satu test untuk setiap data
  test(`login gagal: ${k.judul}`, async ({ page }) => {
    await page.goto('/login-toko.html');
    await page.getByLabel('Username').fill(k.username); // username dari data
    await page.getByLabel('Password').fill(k.password); // password dari data
    await page.getByRole('button', { name: 'Masuk' }).click(); // klik Masuk
    await expect(page.getByRole('alert')).toHaveText(k.pesan); // pesan error sesuai data
  });
}

test.describe('Arena dengan hook', () => {
  // Buka Arena sebelum setiap test di grup ini
  test.beforeEach(async ({ page }) => {
    await page.goto('/arena.html');
    await expect(page.getByRole('heading', { name: 'Arena latihan' })).toBeVisible(); // pastikan halamannya sudah siap
  });

  test('arena klik', async ({ page }) => {
    await page.getByRole('button', { name: 'Klik aku' }).click();
    await expect(page.getByTestId('click-count')).toHaveText('1'); // penghitung jadi 1
  });

  test('arena keyboard', async ({ page }) => {
    await page.getByLabel('Ketik di sini').press('Escape');
    await expect(page.getByTestId('last-key')).toHaveText('Escape'); // tercatat Escape
  });
});

test('total keranjang dua produk', async ({ page }) => {
  // Arrange: login sebagai customer
  await page.goto('/login-toko.html');
  await page.getByLabel('Username').fill('customer'); // isi Username
  await page.getByLabel('Password').fill('rahasia123'); // isi Password
  await page.getByRole('button', { name: 'Masuk' }).click(); // klik Masuk
  const kartu = page.getByTestId('product-card'); // semua kartu produk

  // Act: tambah dua produk
  await kartu.filter({ hasText: 'Mouse Wireless' }).getByRole('button').click();
  await kartu.filter({ hasText: 'Lampu Meja LED' }).getByRole('button').click(); // tambah Lampu Meja LED ke keranjang

  // Assert: jumlah dan total keranjang benar (185.000 + 120.000)
  await expect(page.getByTestId('cart-count')).toHaveText('2');
  await expect(page.getByTestId('cart-total')).toHaveText('Rp 305.000'); // total keranjang sesuai harga kedua produk
});