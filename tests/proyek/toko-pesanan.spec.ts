// TokoQA: keranjang, checkout dengan alamat tersimpan + ongkir, pembatalan, alur status admin, ulasan, dan restock.
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

type Auth = { Authorization: string };

async function token(request: APIRequestContext, username: string, password: string): Promise<Auth> {
  const { token: t } = await (await request.post('/api/login', { data: { username, password } })).json();
  return { Authorization: `Bearer ${t}` };
}

async function buatPesanan(request: APIRequestContext, h: Auth, productId = 2, body: Record<string, unknown> = {}) {
  await request.post('/api/cart', { headers: h, data: { productId, qty: 1 } });
  const res = await request.post('/api/orders', { headers: h, data: { name: 'Rina', address: 'Jl. Braga No. 1, Bandung', ...body } });
  expect(res.status()).toBe(201);
  return res.json();
}

/** Pakai token dari API di browser, supaya test UI tidak perlu mengisi form login. */
async function masukSebagai(page: Page, h: Auth) {
  await page.goto('/login-toko.html');
  await page.evaluate((t) => localStorage.setItem('tokoqa_token', t), h.Authorization.replace('Bearer ', ''));
}

// ---------- API ----------
test('ubah jumlah di keranjang', async ({ request }) => {
  const customer = await token(request, 'customer', 'rahasia123');
  await request.post('/api/cart', { headers: customer, data: { productId: 2, qty: 1 } });

  const diubah = await request.patch('/api/cart/2', { headers: customer, data: { qty: 3 } });
  expect((await diubah.json()).total).toBe(3 * 185_000); // qty menggantikan, bukan menambah

  expect((await request.patch('/api/cart/2', { headers: customer, data: { qty: 9999 } })).status()).toBe(409);
  expect((await request.patch('/api/cart/7', { headers: customer, data: { qty: 1 } })).status()).toBe(404); // belum ada di keranjang
});

test('checkout dengan alamat tersimpan dan express', async ({ request }) => {
  const customer = await token(request, 'customer', 'rahasia123');
  const alamat = await (await request.post('/api/addresses', {
    headers: customer,
    data: { label: 'Kantor', recipient: 'Rina Wulandari', phone: '081234567890', street: 'Jl. Asia Afrika No. 8', city: 'Bandung', postalCode: '40111' },
  })).json();
  await request.post('/api/cart', { headers: customer, data: { productId: 2, qty: 2 } });

  const pesanan = await (await request.post('/api/orders', { headers: customer, data: { addressId: alamat.id, shipping: 'express', payment: 'ewallet' } })).json();

  expect(pesanan.shippingFee).toBe(25_000);
  expect(pesanan.total).toBe(2 * 185_000 + 25_000);
  expect(pesanan.address).toBe('Jl. Asia Afrika No. 8, Bandung 40111');
  expect(pesanan.phone).toBe('081234567890');
  expect(pesanan.history).toEqual([{ status: 'Baru', at: pesanan.createdAt, by: 'customer' }]);
});

test('COD hanya untuk reguler', async ({ request }) => {
  const customer = await token(request, 'customer', 'rahasia123');
  await request.post('/api/cart', { headers: customer, data: { productId: 2, qty: 1 } });
  const res = await request.post('/api/orders', { headers: customer, data: { name: 'Rina', address: 'Bandung', shipping: 'express', payment: 'cod' } });
  expect(res.status()).toBe(422);
  expect((await res.json()).fields).toEqual({ payment: 'COD hanya tersedia untuk pengiriman Reguler.' });
});

test('customer membatalkan pesanan yang masih Baru', async ({ request }) => {
  const customer = await token(request, 'customer', 'rahasia123');
  const pesanan = await buatPesanan(request, customer);

  const batal = await (await request.post(`/api/orders/${pesanan.id}/cancel`, { headers: customer, data: { reason: 'Salah pilih alamat' } })).json();
  expect(batal.status).toBe('Dibatalkan');
  expect(batal.cancelledBy).toBe('customer');
  expect(batal.history.map((h: { status: string }) => h.status)).toEqual(['Baru', 'Dibatalkan']);

  expect((await request.post(`/api/orders/${pesanan.id}/cancel`, { headers: customer, data: {} })).status()).toBe(409); // sudah final
});

test('status pesanan hanya bisa maju', async ({ request }) => {
  const customer = await token(request, 'customer', 'rahasia123');
  const admin = await token(request, 'admin', 'admin123');
  const pesanan = await buatPesanan(request, customer);
  const url = `/api/admin/orders/${pesanan.id}`;

  expect((await request.patch(url, { headers: admin, data: { status: 'Dikirim' } })).ok()).toBe(true); // boleh melompat
  const mundur = await request.patch(url, { headers: admin, data: { status: 'Diproses' } });
  expect(mundur.status()).toBe(409);
  expect((await mundur.json()).error).toBe('Status tidak bisa mundur dari Dikirim ke Diproses.');
  expect((await request.patch(url, { headers: admin, data: { status: 'Dibatalkan' } })).status()).toBe(409); // sudah dikirim
  expect((await request.post(`/api/orders/${pesanan.id}/cancel`, { headers: customer, data: {} })).status()).toBe(409); // customer juga tidak bisa

  const selesai = await (await request.patch(url, { headers: admin, data: { status: 'Selesai' } })).json();
  expect(selesai.history.map((h: { status: string }) => h.status)).toEqual(['Baru', 'Dikirim', 'Selesai']);
});

test('ulasan hanya setelah pesanan Selesai', async ({ request }) => {
  const customer = await token(request, 'customer', 'rahasia123');
  const admin = await token(request, 'admin', 'admin123');
  const pesanan = await buatPesanan(request, customer, 6);
  const ulasan = { rating: 5, comment: 'Mejanya kokoh dan mudah dilipat.' };

  expect((await request.post('/api/products/6/reviews', { headers: customer, data: ulasan })).status()).toBe(403); // belum Selesai
  await request.patch(`/api/admin/orders/${pesanan.id}`, { headers: admin, data: { status: 'Selesai' } });

  const dibuat = await request.post('/api/products/6/reviews', { headers: customer, data: ulasan });
  expect(dibuat.status()).toBe(201);
  const review = await dibuat.json();
  expect(review.mine).toBe(true);
  expect((await request.post('/api/products/6/reviews', { headers: customer, data: ulasan })).status()).toBe(409); // satu ulasan per produk

  const daftar = await (await request.get('/api/products/6/reviews', { headers: customer })).json();
  expect(daftar.data.filter((r: { mine: boolean }) => r.mine).map((r: { id: string }) => r.id)).toEqual([review.id]);
});

test('restock hanya menambah stok', async ({ request }) => {
  const admin = await token(request, 'admin', 'admin123');
  const customer = await token(request, 'customer', 'rahasia123');
  const sebelum = (await (await request.get('/api/products/2')).json()).stock;

  const sesudah = await request.post('/api/admin/products/2/restock', { headers: admin, data: { qty: 5 } });
  expect((await sesudah.json()).stock).toBe(sebelum + 5);

  expect((await request.post('/api/admin/products/8/restock', { headers: admin, data: { qty: 5 } })).status()).toBe(409); // Tas Laptop dikunci
  expect((await request.post('/api/admin/products/2/restock', { headers: admin, data: { qty: 0 } })).status()).toBe(422);
  expect((await request.post('/api/admin/products/2/restock', { headers: customer, data: { qty: 5 } })).status()).toBe(403);
});

// ---------- UI ----------
test('customer membatalkan pesanan lewat UI', async ({ page, request }) => {
  const customer = await token(request, 'customer', 'rahasia123');
  const pesanan = await buatPesanan(request, customer);
  await masukSebagai(page, customer);

  await page.goto(`/order.html?id=${pesanan.id}`);
  await page.getByRole('button', { name: 'Batalkan pesanan' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Alasan pembatalan').selectOption('Berubah pikiran');
  await dialog.getByRole('button', { name: 'Batalkan pesanan' }).click();

  await expect(page.getByTestId('order-status')).toHaveText('Dibatalkan');
  await expect(page.getByTestId('cancel-info')).toContainText('Berubah pikiran');
  await expect(page.getByRole('button', { name: 'Batalkan pesanan' })).toHaveCount(0);
});

test('admin memproses pesanan dari halaman detail', async ({ page, request }) => {
  const customer = await token(request, 'customer', 'rahasia123');
  const admin = await token(request, 'admin', 'admin123');
  const pesanan = await buatPesanan(request, customer);
  await masukSebagai(page, admin);

  await page.goto(`/admin-order.html?id=${pesanan.id}`);
  await page.getByRole('button', { name: 'Proses pesanan' }).click();
  await expect(page.getByTestId('order-status')).toHaveText('Diproses');
  await page.getByRole('button', { name: 'Kirim pesanan' }).click();
  await expect(page.getByTestId('order-status')).toHaveText('Dikirim');

  // Setelah dikirim, pesanan tidak bisa dibatalkan dan tidak bisa mundur
  await expect(page.getByRole('button', { name: 'Batalkan pesanan' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Selesaikan pesanan' })).toBeVisible();
});

test('checkout UI dengan alamat tersimpan dan express', async ({ page, request }) => {
  const customer = await token(request, 'customer', 'rahasia123');
  await request.post('/api/addresses', {
    headers: customer,
    data: { label: 'Rumah', recipient: 'Rina Wulandari', phone: '081234567890', street: 'Jl. Dago No. 10', city: 'Bandung', postalCode: '40135' },
  });
  await request.post('/api/cart', { headers: customer, data: { productId: 7, qty: 1 } });
  await masukSebagai(page, customer);

  await page.goto('/checkout.html');
  await expect(page.getByTestId('address-option')).toContainText('Jl. Dago No. 10');
  await page.getByRole('button', { name: 'Lanjut ke pengiriman' }).click();
  await page.getByLabel('Express').check();
  await page.getByRole('button', { name: 'Lanjut ke pembayaran' }).click();

  await expect(page.getByLabel('COD')).toBeDisabled(); // COD hanya untuk Reguler
  await expect(page.getByTestId('summary-total')).toHaveText('Rp 145.000'); // 120.000 + ongkir 25.000
  await page.getByLabel('E-Wallet').check();
  await page.getByLabel('Saya setuju dengan syarat & ketentuan').check();
  await page.getByRole('button', { name: 'Bayar sekarang' }).click();
  await expect(page.getByTestId('order-total')).toHaveText('Rp 145.000');
});