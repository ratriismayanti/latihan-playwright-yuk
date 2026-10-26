// Modul 13 — API testing dengan request fixture + validasi JSON Schema.
import { test, expect } from '@playwright/test';
import { Ajv } from 'ajv';

const productSchema = { // bentuk satu produk yang diharapkan (JSON Schema)
  type: 'object',
  required: ['id', 'name', 'category', 'price', 'stock'],
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    category: { enum: ['Elektronik', 'Furnitur', 'Aksesoris'] },
    price: { type: 'integer', minimum: 0 },
    stock: { type: 'integer', minimum: 0 },
  },
};
const productListSchema = { // bentuk respons daftar produk
  type: 'object',
  required: ['total', 'data'],
  properties: { total: { type: 'integer' }, data: { type: 'array', items: productSchema } },
};
const validateProductList = new Ajv().compile(productListSchema); // siapkan validator dari schema

async function loginToken(request: import('@playwright/test').APIRequestContext) { // login lewat API, kembalikan token
  const res = await request.post('/api/login', { data: { username: 'customer', password: 'rahasia123' } });
  return (await res.json()).token as string; // token dari respons login
}

test('GET semua produk', async ({ request }) => {
  const res = await request.get('/api/products');
  await expect(res).toBeOK(); // status 2xx
  const body = await res.json(); // isi respons
  expect(body.total).toBe(8); // ada 8 produk
  expect(validateProductList(body), JSON.stringify(validateProductList.errors)).toBe(true); // bentuk respons sesuai schema (pesan error ikut ditampilkan kalau gagal)
});

test('GET produk dengan query', async ({ request }) => {
  const res = await request.get('/api/products', { params: { q: 'mouse' } });
  const { data } = await res.json(); // daftar produk hasil pencarian
  expect(data.map((p: { name: string }) => p.name)).toEqual(['Mouse Wireless']); // hanya Mouse Wireless
});

test('produk tidak ada', async ({ request }) => {
  const res = await request.get('/api/products/999');
  expect(res.status()).toBe(404); // status 404
  expect(await res.json()).toEqual({ error: 'Produk tidak ditemukan' }); // isi error persis ini
});

test('login berhasil dapat token', async ({ request }) => {
  const res = await request.post('/api/login', { data: { username: 'customer', password: 'rahasia123' } });
  expect(res.status()).toBe(200); // status 200
  const body = await res.json(); // isi respons
  expect(body.user.name).toBe('Rina Wulandari'); // nama pengguna di respons
  expect(body.token.split('.')).toHaveLength(3); // format JWT: header.payload.signature
});

const loginGagal = [ // tabel data login yang gagal
  { data: { username: 'customer', password: 'salah' }, status: 401 },
  { data: { username: 'terkunci', password: 'rahasia123' }, status: 403 },
  { data: {}, status: 400 },
];
for (const { data, status } of loginGagal) { // satu test untuk setiap baris
  test(`login gagal → ${status}`, async ({ request }) => {
    const res = await request.post('/api/login', { data });
    expect(res.status()).toBe(status); // status sesuai tabel
    expect(await res.json()).toHaveProperty('error'); // respons berisi pesan error
  });
}

test('keranjang butuh token', async ({ request }) => {
  expect((await request.get('/api/cart')).status()).toBe(401);
});

test('tambah ke keranjang', async ({ request }) => {
  const token = await loginToken(request);
  const res = await request.post('/api/cart', { // tambah 2 Mouse Wireless ke keranjang
    data: { productId: 2, qty: 2 },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(201); // status 201 (dibuat)
  const cart = await res.json(); // isi keranjang
  expect(cart.totalQty).toBe(2); // jumlah barang 2
  expect(cart.total).toBe(2 * 185_000); // total = 2 x harga
});

test('stok tidak cukup', async ({ request }) => {
  const token = await loginToken(request);
  const res = await request.post('/api/cart', { // coba tambah Tas Laptop
    data: { productId: 8, qty: 1 }, // Tas Laptop stok 0
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(409); // stoknya habis: 409
});