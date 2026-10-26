import { test, expect, APIRequestContext } from '@playwright/test';
import { nextOpenDay } from '../../pages/KlinikPage';
import { randomUUID } from 'node:crypto';
import { muatKontrak } from '../../utils/kontrak';



test('profil admin', async ({ request }) => {
  const res = await request.post('/api/login', { data: { username: 'admin', password: 'admin123' } });
  const { token } = await res.json(); // token dari respons
  const me = await request.get('/api/me', { headers: { Authorization: `Bearer ${token}` } }); // panggil endpoint yang butuh login
  expect(me.status()).toBe(200); // berhasil
  expect((await me.json()).role).toBe('admin'); // perannya admin
});


// Fixture { request } bawaan Playwright Test sudah memakai baseURL dari playwright.config.ts.
async function tokenUntuk(request: APIRequestContext, username: string, password: string) {
  const res = await request.post('/api/login', { data: { username, password } });
  return { Authorization: `Bearer ${(await res.json()).token}` }; // header siap pakai
}


test('alur pesanan lewat API', async ({ request }) => {
  const auth = await tokenUntuk(request, 'customer', 'rahasia123');
  expect((await request.post('/api/cart', { headers: auth, data: { productId: 2, qty: 1 } })).status()).toBe(201); // tambah Mouse Wireless
  expect((await request.post('/api/cart', { headers: auth, data: { productId: 7, qty: 1 } })).status()).toBe(201); // tambah Lampu Meja LED

  const res = await request.post('/api/orders', { headers: auth, data: { name: 'Rina', address: 'Jl. Asia Afrika 8, Bandung' } }); // buat pesanan dari isi keranjang
  expect(res.status()).toBe(201); // status 201 (dibuat)
  const pesanan = await res.json(); // isi pesanan
  expect(pesanan.id).toMatch(/^TQA-/); // nomor diawali TQA-
  expect(pesanan.status).toBe('Baru'); // status awal Baru
  expect(pesanan.total).toBe(185000 + 120000); // total kedua barang
});

test('checkout UI lalu cek keranjang lewat API', async ({ page }) => {
  await page.goto('/login-toko.html');
  await page.getByLabel('Username').fill('customer'); // isi Username
  await page.getByLabel('Password').fill('rahasia123'); // isi Password
  await page.getByRole('button', { name: 'Masuk' }).click(); // klik Masuk
  await page.getByTestId('product-card').filter({ hasText: 'Mouse Wireless' }).getByRole('button').click(); // tambah Mouse Wireless lewat UI
  await page.getByRole('button', { name: 'Checkout' }).click(); // mulai checkout
  await page.getByLabel('Nama penerima').fill('Rina'); // nama penerima
  await page.getByLabel('Nomor HP').fill('081234567890'); // nomor HP
  await page.getByLabel('Alamat jalan').fill('Jl. Braga No. 1'); // alamat jalan
  await page.getByLabel('Kota').fill('Bandung'); // kota
  await page.getByLabel('Kode pos').fill('40111'); // kode pos
  await page.getByRole('button', { name: 'Lanjut ke pengiriman' }).click(); // lanjut ke pengiriman
  await page.getByRole('button', { name: 'Lanjut ke pembayaran' }).click(); // lanjut ke pembayaran
  await page.getByLabel('Saya setuju dengan syarat & ketentuan').check(); // centang persetujuan
  await page.getByRole('button', { name: 'Bayar sekarang' }).click(); // bayar
  await expect(page.getByRole('heading', { name: 'Pesanan berhasil!' })).toBeVisible(); // pesanan berhasil di UI

  // Token yang dipakai UI tersimpan di localStorage. Pakai token yang sama untuk API.
  const token = await page.evaluate(() => localStorage.getItem('tokoqa_token'));
  const keranjang = await (await page.request.get('/api/cart', { headers: { Authorization: `Bearer ${token}` } })).json(); // cek keranjang lewat API dengan token yang sama
  expect(keranjang.items).toEqual([]); // keranjang kosong setelah checkout
});

test('produk kosong', async ({ page }) => {
  await page.route('**/api/products', (route) => route.fulfill({ json: { total: 0, data: [] } }));
  await page.goto('/arena.html'); // buka Arena
  await page.getByRole('button', { name: 'Ambil produk' }).click(); // halaman memanggil API
  await expect(page.getByTestId('api-count')).toHaveText('0 produk'); // halaman menampilkan 0 produk
  await expect(page.locator('#api-list li')).toHaveCount(0); // daftarnya kosong
});

test('klinik: token dan slot bentrok', async ({ request }) => {
  // Tanpa token: 401. Login memberi token, lalu token dikirim di header Authorization.
  expect((await request.get('/api/klinik/me')).status()).toBe(401);
  const { token } = await (await request.post('/api/klinik/login', { data: { username: 'pasien', password: 'sehat123' } })).json(); // login klinik lewat API, ambil token
  const auth = { Authorization: `Bearer ${token}` }; // header token
  expect((await (await request.get('/api/klinik/me', { headers: auth })).json()).role).toBe('pasien'); // token berlaku: perannya pasien

  const janji = { doctorId: 2, date: nextOpenDay(4), time: '13:00', complaint: 'Anak demam dan batuk sejak kemarin' }; // data janji temu
  expect((await request.post('/api/klinik/appointments', { headers: auth, data: janji })).status()).toBe(201); // dibuat (201)
  const bentrok = await request.post('/api/klinik/appointments', { headers: auth, data: janji }); // kirim janji yang sama persis
  expect(bentrok.status()).toBe(409); // ditolak: jamnya sudah terisi
  expect((await bentrok.json()).error).toContain('sudah terisi'); // pesan error menjelaskan sebabnya
});

test('perpus: dua peran dengan login', async ({ request }) => {
  expect((await request.get('/api/perpus/me')).status()).toBe(401); // tanpa token

  // Pustakawan membuka perpustakaan, login, lalu mendaftarkan anggota
  const pustakawan = { username: `pustakawan-${randomUUID().slice(0, 6)}`, password: 'rahasia123' };
  await request.post('/api/perpus/libraries', { data: { name: 'Latihan API', ...pustakawan } }); // buka perpustakaan baru
  const kunci = { Authorization: `Bearer ${(await (await request.post('/api/perpus/login', { data: pustakawan })).json()).token}` }; // header token pustakawan
  const rina = { username: `rina-${randomUUID().slice(0, 6)}`, password: 'baca123' }; // akun anggota acak
  await request.post('/api/perpus/members', { headers: kunci, data: { name: 'Rina', ...rina } }); // pustakawan mendaftarkan Rina
  const kunciRina = { Authorization: `Bearer ${(await (await request.post('/api/perpus/login', { data: rina })).json()).token}` }; // header token Rina

  const pinjam = await request.post('/api/perpus/loans', { headers: kunciRina, data: { bookId: 4 } }); // Rina meminjam buku nomor 4
  expect(pinjam.status()).toBe(201); // berhasil (201)
  const { id } = await pinjam.json(); // nomor pinjaman
  const { data: aktif } = await (await request.get('/api/perpus/loans', { headers: kunci, params: { status: 'aktif' } })).json(); // pustakawan melihat pinjaman aktif
  expect(aktif.map((x: { id: string }) => x.id)).toEqual([id]); // pustakawan melihat pinjaman anggota

  // Peran menentukan hak: anggota tidak boleh menambah buku
  const buku = { title: 'Buku Baru', author: 'Penulis Uji', year: 2020, category: 'Sains', copies: 1 };
  const tambah = await request.post('/api/perpus/books', { headers: kunciRina, data: buku }); // anggota mencoba menambah buku
  expect(tambah.status()).toBe(403); // ditolak 403
  expect((await tambah.json()).reason).toBe('role'); // alasannya peran

  await request.post(`/api/perpus/loans/${id}/return`, { headers: kunci }); // pustakawan menerima pengembalian
  expect((await (await request.get('/api/perpus/me', { headers: kunciRina })).json()).activeLoans).toBe(0); // pinjaman aktif Rina kembali 0

  // Logout mengakhiri sesi: key lama ditolak
  await request.post('/api/perpus/logout', { headers: kunciRina });
  expect((await (await request.get('/api/perpus/me', { headers: kunciRina })).json()).reason).toBe('invalid'); // token lama tidak berlaku setelah logout
});

test('kontrak: ubah buku', async ({ request }) => {
  const kontrak = await muatKontrak(request, 'perpusqa');
  const login = async (username: string, password: string) => // login lalu kembalikan header token
    ({ Authorization: `Bearer ${(await (await request.post('/api/perpus/login', { data: { username, password } })).json()).token}` });
  const kunci = await login('pustakawan', 'pustaka123'); // header token pustakawan demo
  const kunciRina = await login('anggota', 'baca123'); // header token anggota demo

  const kosong = await request.patch('/api/perpus/books/13', { headers: kunci, data: {} }); // kirim body kosong
  await kontrak.cek('PATCH', '/api/perpus/books/{id}', kosong); // 422 terdaftar, bentuknya ValidationError
  expect((await kosong.json()).fields).toHaveProperty('_'); // error umum ditaruh di field _

  const olehAnggota = await request.patch('/api/perpus/books/13', { headers: kunciRina, data: { copies: 5 } }); // anggota mencoba mengubah buku
  await kontrak.cek('PATCH', '/api/perpus/books/{id}', olehAnggota); // 403 terdaftar, bentuknya Error
  expect((await olehAnggota.json()).reason).toBe('role'); // ditolak karena peran

  const detail = await request.get('/api/perpus/books/13', { headers: kunci }); // detail buku tidak berubah
  await kontrak.cek('GET', '/api/perpus/books/{id}', detail); // 200, bentuknya Book
});

test('admin mengirim pesanan, customer melihat statusnya', async ({ browser, baseURL }) => {
  // Dua context = dua orang yang berbeda di browser yang sama
  const customer = await (await browser.newContext({ baseURL })).newPage();
  const admin = await (await browser.newContext({ baseURL })).newPage(); // browser kedua untuk admin

  // Customer membuat pesanan (persiapan lewat API, memakai token customer)
  const login = await customer.request.post('/api/login', { data: { username: 'customer', password: 'rahasia123' } });
  const { token } = await login.json(); // token customer
  const h = { Authorization: `Bearer ${token}` }; // header token customer
  await customer.request.post('/api/cart', { headers: h, data: { productId: 1, qty: 1 } }); // siapkan keranjang lewat API
  const pesanan = (await (await customer.request.post('/api/orders', { headers: h, data: { name: 'Rina', address: 'Bandung' } })).json()).id; // buat pesanan lewat API, simpan nomornya

  // Admin mengubah status lewat dashboard
  await admin.goto('/login-toko.html');
  await admin.getByLabel('Username').fill('admin'); // admin: isi Username
  await admin.getByLabel('Password').fill('admin123'); // isi Password
  await admin.getByRole('button', { name: 'Masuk' }).click(); // klik Masuk
  await expect(admin.getByRole('heading', { name: 'Dashboard admin' })).toBeVisible(); // masuk dashboard admin
  await admin.getByLabel(`Status pesanan ${pesanan}`).selectOption('Dikirim'); // ubah status pesanan itu
  await expect(admin.getByRole('status')).toHaveText(`Status ${pesanan} diubah menjadi Dikirim`); // notifikasi perubahan status

  // Customer melihat status baru di halaman Pesanan saya
  await customer.goto('/login-toko.html');
  await customer.evaluate((t) => localStorage.setItem('tokoqa_token', t), token); // pasang token customer di browser customer
  await customer.goto('/shop.html'); // buka toko
  await customer.getByRole('link', { name: 'Pesanan saya' }).click(); // buka Pesanan saya
  const baris = customer.getByTestId('my-order-row').filter({ hasText: pesanan }); // baris pesanan tadi
  await expect(baris.getByTestId('order-status')).toHaveText('Dikirim'); // customer melihat status Dikirim
  await expect(baris).toContainText(/Rp 750\.000/); // totalnya Rp 750.000

  await customer.context().close(); // tutup browser customer
  await admin.context().close(); // tutup browser admin
});