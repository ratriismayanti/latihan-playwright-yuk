import { test, expect } from '@playwright/test';

test('belanja elektronik sampai bayar', async ({ page }) => {
  await page.goto('/login-toko.html');
  await page.getByTestId('login-button').click();
  await page.getByRole('textbox', { name: 'Username' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('customer');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('rahasia123');
  await page.getByTestId('login-button').click();
  await page.getByLabel('Kategori').selectOption('Elektronik');
  await page.getByRole('article').filter({ hasText: 'Elektronik Keyboard Mekanik ★' }).getByRole('button').click();
  await page.getByRole('article').filter({ hasText: 'Elektronik Headset Gaming ★4' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByRole('textbox', { name: 'Nomor HP' }).click();
  await page.getByRole('textbox', { name: 'Nomor HP' }).fill('09876643456');
  await page.getByRole('textbox', { name: 'Nama penerima' }).click();
  await page.getByRole('textbox', { name: 'Nama penerima' }).fill('gg');
  await page.getByRole('textbox', { name: 'Kota' }).click();
  await page.getByRole('textbox', { name: 'Kota' }).fill('purworejo');
  await page.getByRole('textbox', { name: 'Alamat jalan' }).click();
  await page.getByRole('textbox', { name: 'Alamat jalan' }).fill('jl.hdndsjs 45 ');
  await page.getByRole('button', { name: 'Lanjut ke pengiriman' }).click();
  await page.getByRole('textbox', { name: 'Nomor HP' }).click();
  await page.getByRole('textbox', { name: 'Nomor HP' }).fill('0887664345654');
  await page.getByRole('textbox', { name: 'Kode pos' }).click();
  await page.getByRole('textbox', { name: 'Kode pos' }).fill('56789');
  await page.getByRole('button', { name: 'Lanjut ke pengiriman' }).click();
  await page.getByRole('button', { name: 'Lanjut ke pembayaran' }).click();
  await page.getByRole('radio', { name: 'E-Wallet' }).check();
  await page.getByRole('checkbox', { name: 'Saya setuju dengan syarat &' }).check();
  await page.getByRole('button', { name: 'Bayar sekarang' }).click();
  // Assert
  await expect(page.getByRole('heading', { name: 'Pesanan berhasil!' })).toBeVisible();
  await expect(page.getByTestId('order-id')).toHaveText(/^TQA-\d+$/); // nomor pesanan berpola TQA- diikuti angka
  await expect(page.getByTestId('order-total')).toHaveText('Rp 1.170.000'); // total = harga kedua produk

});