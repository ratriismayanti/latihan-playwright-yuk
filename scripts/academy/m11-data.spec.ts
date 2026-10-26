// Modul 11 — Data tes (.env & JSON) dan storage state.
import { readFileSync } from 'node:fs';
import { test, expect } from '../../fixtures';
import { LoginPage } from '../../pages/LoginPage';

type CheckoutCase = { case: string; recipient: string; phone: string; postalCode: string; error: string }; // bentuk satu kasus di file JSON
const checkoutCases: CheckoutCase[] = JSON.parse( // baca data/checkout-cases.json
  readFileSync(new URL('../../data/checkout-cases.json', import.meta.url), 'utf-8'),
);

test('login pakai kredensial dari .env', async ({ loginPage, shopPage }) => {
  await loginPage.open();
  await loginPage.login(process.env.TOKOQA_USERNAME!, process.env.TOKOQA_PASSWORD!); // kredensial dari .env
  await expect(shopPage.greeting).toContainText('Halo'); // sudah masuk
});

for (const c of checkoutCases) { // satu test untuk setiap kasus
  test(`validasi alamat checkout: ${c.case}`, async ({ loggedInShop, checkoutPage }) => {
    await loggedInShop.addToCart('Mouse Wireless');
    await expect(loggedInShop.cartCount).toHaveText('1'); // keranjang berisi 1
    await loggedInShop.goToCheckout(); // mulai checkout

    await checkoutPage.fillAddress(c.recipient, c.phone, 'Jl. Merdeka No. 1', 'Bandung', c.postalCode); // isi alamat dengan data salah dari JSON
    await checkoutPage.continueToShipping(); // coba lanjut

    // Pesan muncul di bawah kolom yang salah, dan checkout tetap di langkah alamat
    await expect(checkoutPage.page.getByText(c.error)).toBeVisible();
    await expect(checkoutPage.toShippingButton).toBeVisible(); // masih di langkah alamat, tidak bisa lanjut
  });
}

test('wajib setuju syarat sebelum bayar', async ({ loggedInShop, checkoutPage }) => {
  await loggedInShop.addToCart('Mouse Wireless');
  await loggedInShop.goToCheckout(); // mulai checkout
  await checkoutPage.fillAddress('Rina', '081234567890', 'Jl. Merdeka No. 1', 'Bandung', '40111'); // alamat valid
  await checkoutPage.continueToShipping(); // lanjut ke pengiriman
  await checkoutPage.continueToPayment(); // lanjut ke pembayaran

  await checkoutPage.submit(); // bayar tanpa mencentang persetujuan

  await expect(checkoutPage.error).toHaveText('Kamu harus menyetujui syarat & ketentuan'); // pesan error persetujuan
});

test('simpan dan pakai ulang storage state', async ({ browser }, testInfo) => {
  // 1) Login sekali, simpan "status login" ke file
  const context = await browser.newContext();
  const page = await context.newPage(); // tab baru di context pertama
  const login = new LoginPage(page); // page object login
  await login.open(); // buka halaman login
  await login.login(process.env.TOKOQA_USERNAME!, process.env.TOKOQA_PASSWORD!); // login sekali
  await expect(page.getByTestId('greeting')).toBeVisible(); // sudah masuk
  const stateFile = testInfo.outputPath('auth.json');
  await context.storageState({ path: stateFile }); // simpan cookies dan localStorage ke file
  await context.close(); // tutup context pertama

  // 2) Context baru langsung sudah login tanpa mengisi form lagi
  const context2 = await browser.newContext({ storageState: stateFile });
  const page2 = await context2.newPage(); // tab baru di context yang sudah login
  await page2.goto('/shop.html'); // langsung buka toko
  await expect(page2.getByTestId('greeting')).toHaveText('Halo, Rina Wulandari'); // sapaan muncul tanpa login ulang
  await context2.close(); // tutup context kedua
});