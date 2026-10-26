// TokoQA: CRUD kupon promo oleh admin, lalu dipakai customer. Kode kupon dibuat acak supaya test paralel aman.
import { randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext } from '@playwright/test';

async function token(request: APIRequestContext, username: string, password: string) {
  const { token: t } = await (await request.post('/api/login', { data: { username, password } })).json();
  return { Authorization: `Bearer ${t}` };
}
const kodeUnik = () => `UJI${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;

test('CRUD kupon', async ({ request }) => {
  const admin = await token(request, 'admin', 'admin123');
  const kode = kodeUnik();
  const dibuat = await request.post('/api/admin/coupons', { headers: admin, data: { code: kode, type: 'percent', value: 25, minSubtotal: 300000 } });
  expect(dibuat.status()).toBe(201);
  expect(dibuat.headers()['location']).toBe(`/api/admin/coupons/${kode}`);
  expect((await dibuat.json()).label).toBe('Diskon 25% (min. belanja Rp 300.000)'); // label dibuat otomatis

  expect((await (await request.get(`/api/admin/coupons/${kode}`, { headers: admin })).json()).system).toBe(false);
  const diubah = await request.patch(`/api/admin/coupons/${kode}`, { headers: admin, data: { type: 'fixed', value: 75000 } });
  expect((await diubah.json()).label).toBe('Potongan Rp 75.000 (min. belanja Rp 300.000)');

  expect((await request.delete(`/api/admin/coupons/${kode}`, { headers: admin })).status()).toBe(204);
  expect((await request.get(`/api/admin/coupons/${kode}`, { headers: admin })).status()).toBe(404);
});

test('validasi, kode dobel, dan kupon bawaan', async ({ request }) => {
  const admin = await token(request, 'admin', 'admin123');
  const salah = await request.post('/api/admin/coupons', { headers: admin, data: { code: 'ab', type: 'gratis', value: 10 } });
  expect(salah.status()).toBe(422);
  expect(Object.keys((await salah.json()).fields).sort()).toEqual(['code', 'type']);
  const terlaluBesar = await request.post('/api/admin/coupons', { headers: admin, data: { code: kodeUnik(), type: 'percent', value: 95 } });
  expect((await terlaluBesar.json()).fields.value).toBe('Diskon persen harus 1 sampai 90.');

  expect((await request.post('/api/admin/coupons', { headers: admin, data: { code: 'HEMAT10', type: 'percent', value: 5 } })).status()).toBe(409);
  for (const res of [await request.patch('/api/admin/coupons/HEMAT10', { headers: admin, data: { value: 50 } }), await request.delete('/api/admin/coupons/HEMAT10', { headers: admin })]) {
    expect(res.status()).toBe(409); // kupon bawaan sistem dikunci
  }
});

test('customer tidak bisa mengelola kupon', async ({ request }) => {
  const customer = await token(request, 'customer', 'rahasia123');
  expect((await request.post('/api/admin/coupons', { headers: customer, data: { code: kodeUnik(), type: 'percent', value: 10 } })).status()).toBe(403);
});

test('kupon buatan admin dipakai customer', async ({ request }) => {
  const admin = await token(request, 'admin', 'admin123');
  const customer = await token(request, 'customer', 'rahasia123');
  const kode = kodeUnik();
  await request.post('/api/admin/coupons', { headers: admin, data: { code: kode, type: 'percent', value: 20 } });
  await request.post('/api/cart', { headers: customer, data: { productId: 2, qty: 2 } }); // 2 x Rp 185.000

  const pakai = await request.post('/api/coupons/apply', { headers: customer, data: { code: kode.toLowerCase() } }); // tidak peka huruf besar-kecil
  expect(pakai.status()).toBe(200);
  expect(await pakai.json()).toMatchObject({ discount: 74000, totalAfterDiscount: 296000 });

  await request.patch(`/api/admin/coupons/${kode}`, { headers: admin, data: { expired: true } });
  expect((await request.post('/api/coupons/apply', { headers: customer, data: { code: kode } })).status()).toBe(410);
});

test('admin mengelola kupon lewat UI', async ({ page }) => {
  const kode = kodeUnik();
  await page.goto('/login-toko.html');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.getByRole('tab', { name: 'Kupon' }).click();

  await page.getByLabel('Kode kupon').fill(kode);
  await page.getByLabel('Jenis').selectOption({ label: 'Potongan nominal' });
  await page.getByLabel('Nilai').fill('50000');
  await page.getByRole('button', { name: 'Tambah kupon' }).click();
  const baris = page.getByTestId('coupon-row').filter({ hasText: kode });
  await expect(baris).toContainText('Potongan Rp 50.000');

  await page.getByRole('button', { name: `Nonaktifkan ${kode}` }).click();
  await expect(baris.getByTestId('coupon-status')).toHaveText('Berakhir');

  await page.getByRole('button', { name: `Hapus ${kode}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hapus kupon' }).click();
  await expect(baris).toHaveCount(0);
});