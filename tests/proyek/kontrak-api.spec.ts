// Contract test: respons asli ketiga API harus sesuai kontrak OpenAPI di /spec/<proyek>.json.
// Bedanya dengan test fungsional: test ini tidak mengecek nilai bisnis (misalnya total harga), tapi BENTUK
// respons untuk setiap status: field wajib ada, tipe benar, tidak ada field tambahan, header wajib ikut.
import { randomUUID } from 'node:crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { test, expect } from '../../fixtures';
import { nextOpenDay } from '../../pages/KlinikPage';
import { loginKlinik } from '../../utils/klinik-api';
import { daysAgo } from '../../pages/PerpusPage';
import { muatKontrak } from '../../utils/kontrak';

test('kontrak TokoQA', async ({ request }) => {
  const k = await muatKontrak(request, 'tokoqa');
  await k.cek('POST', '/api/login', await request.post('/api/login', { data: { username: 'customer', password: 'salah' } }));
  const login = await request.post('/api/login', { data: { username: 'customer', password: 'rahasia123' } });
  await k.cek('POST', '/api/login', login);
  const headers = { Authorization: `Bearer ${(await login.json()).token}` };

  await k.cek('GET', '/api/me', await request.get('/api/me')); // 401
  await k.cek('GET', '/api/me', await request.get('/api/me', { headers }));
  await k.cek('GET', '/api/products', await request.get('/api/products')); // tanpa info halaman
  await k.cek('GET', '/api/products', await request.get('/api/products', { params: { page: 1, limit: 3 } })); // dengan info halaman
  await k.cek('GET', '/api/products/{id}', await request.get('/api/products/99')); // 404
  await k.cek('POST', '/api/cart', await request.post('/api/cart', { headers, data: { productId: 2, qty: 1 } })); // 201
  await k.cek('POST', '/api/addresses', await request.post('/api/addresses', { headers, data: { label: 'Rumah' } })); // 422
  await k.cek('PATCH', '/api/cart/{productId}', await request.patch('/api/cart/2', { headers, data: { qty: 2 } })); // 200
  await k.cek('GET', '/api/products/{id}/reviews', await request.get('/api/products/2/reviews')); // publik
  await k.cek('POST', '/api/products/{id}/reviews', await request.post('/api/products/2/reviews', { headers, data: { rating: 5, comment: 'Belum pernah beli' } })); // 403
  const alamat = await request.post('/api/addresses', { headers, data: { label: 'Kantor', recipient: 'Rina', phone: '081234567890', street: 'Jl. Braga No. 1', city: 'Bandung', postalCode: '40111' } });
  await k.cek('POST', '/api/addresses', alamat); // 201 dengan street
  const order = await request.post('/api/orders', { headers, data: { addressId: (await alamat.json()).id, shipping: 'express', payment: 'ewallet' } });
  await k.cek('POST', '/api/orders', order); // 201 + Location, ongkir dan history
  const orderId = (await order.json()).id;
  await k.cek('POST', '/api/orders', await request.post('/api/orders', { headers, data: { name: 'Rina', address: 'Bandung' } })); // 400 keranjang kosong
  await k.cek('POST', '/api/orders/{id}/cancel', await request.post(`/api/orders/${orderId}/cancel`, { headers, data: { reason: 'Salah pilih' } })); // 200
  await k.cek('GET', '/api/admin/orders', await request.get('/api/admin/orders', { headers })); // 403 untuk customer

  // CRUD kupon oleh admin
  const admin = { Authorization: `Bearer ${(await (await request.post('/api/login', { data: { username: 'admin', password: 'admin123' } })).json()).token}` };
  const kode = `UJI${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  await k.cek('POST', '/api/admin/coupons', await request.post('/api/admin/coupons', { headers: admin, data: { code: kode, type: 'percent', value: 15 } })); // 201
  await k.cek('GET', '/api/admin/coupons', await request.get('/api/admin/coupons', { headers: admin }));
  await k.cek('PATCH', '/api/admin/coupons/{code}', await request.patch('/api/admin/coupons/HEMAT10', { headers: admin, data: { value: 50 } })); // 409 bawaan
  await k.cek('DELETE', '/api/admin/coupons/{code}', await request.delete(`/api/admin/coupons/${kode}`, { headers: admin })); // 204

  // Pesanan dan produk oleh admin
  await k.cek('GET', '/api/admin/orders', await request.get('/api/admin/orders', { headers: admin, params: { page: 1, limit: 5 } })); // dengan info halaman
  await k.cek('GET', '/api/admin/orders/{id}', await request.get(`/api/admin/orders/${orderId}`, { headers: admin }));
  await k.cek('PATCH', '/api/admin/orders/{id}', await request.patch(`/api/admin/orders/${orderId}`, { headers: admin, data: { status: 'Diproses' } })); // 409 sudah dibatalkan
  await k.cek('GET', '/api/admin/products', await request.get('/api/admin/products', { headers: admin }));
  await k.cek('POST', '/api/admin/products/{id}/restock', await request.post('/api/admin/products/8/restock', { headers: admin, data: { qty: 5 } })); // 409 dikunci
});

test('kontrak KlinikQA', async ({ request, baseURL }) => {
  const k = await muatKontrak(request, 'klinikqa');
  await k.cek('GET', '/api/klinik/me', await request.get('/api/klinik/me')); // 401
  await k.cek('POST', '/api/klinik/login', await request.post('/api/klinik/login', { data: { username: 'pasien', password: 'sehat123' } }));
  const pasien = await loginKlinik(baseURL, 'pasien', 'sehat123'); // mengirim token di header Authorization
  await k.cek('GET', '/api/klinik/me', await pasien.get('/api/klinik/me'));
  await k.cek('GET', '/api/klinik/slots', await pasien.get('/api/klinik/slots', { params: { doctorId: 1, date: nextOpenDay(2) } }));
  await k.cek('GET', '/api/klinik/calendar', await pasien.get('/api/klinik/calendar', { params: { doctorId: 3 } }));
  const janji = { doctorId: 1, date: nextOpenDay(9), time: '08:30', complaint: 'Pemeriksaan kesehatan rutin' };
  await k.cek('POST', '/api/klinik/appointments', await pasien.post('/api/klinik/appointments', { data: janji })); // 201
  await k.cek('POST', '/api/klinik/appointments', await pasien.post('/api/klinik/appointments', { data: janji })); // 409
  await k.cek('POST', '/api/klinik/appointments', await pasien.post('/api/klinik/appointments', { data: {} })); // 422
  const { data: daftar } = await (await pasien.get('/api/klinik/appointments')).json();
  const janjiId = daftar[daftar.length - 1].id;
  await k.cek('PATCH', '/api/klinik/appointments/{id}', await pasien.patch(`/api/klinik/appointments/${janjiId}`, { data: { time: '09:00' } })); // 409
  await k.cek('GET', '/api/klinik/appointments/{id}/notes', await pasien.get(`/api/klinik/appointments/${janjiId}/notes`));
  await k.cek('POST', '/api/klinik/appointments/{id}/notes', await pasien.post(`/api/klinik/appointments/${janjiId}/notes`, { data: { kind: 'Saran', text: 'Tulis sendiri' } })); // 403 pasien
  await k.cek('GET', '/api/klinik/appointments', await pasien.get('/api/klinik/appointments', { params: { page: 1, limit: 5 } })); // dengan info halaman
  await k.cek('GET', '/api/klinik/agenda', await pasien.get('/api/klinik/agenda')); // 403 pasien
  await k.cek('GET', '/api/klinik/appointments/{id}/patient', await pasien.get(`/api/klinik/appointments/${janjiId}/patient`)); // 403 pasien

  // Sisi dokter (request context lain dengan token sendiri): agenda per hari dan data pasien
  const dokter = await loginKlinik(baseURL, 'dokter', 'dokter123');
  await k.cek('GET', '/api/klinik/agenda', await dokter.get('/api/klinik/agenda', { params: { date: janji.date } }));
  await k.cek('GET', '/api/klinik/appointments/{id}/patient', await dokter.get(`/api/klinik/appointments/${janjiId}/patient`));
  await dokter.dispose();
  await k.cek('POST', '/api/klinik/logout', await pasien.post('/api/klinik/logout')); // 204 tanpa body
  await pasien.dispose();
});

test('kontrak PerpusQA', async ({ request, perpus, operatorApi, daftarAnggota }) => {
  const k = await muatKontrak(request, 'perpusqa');
  await k.cek('POST', '/api/perpus/login', await request.post('/api/perpus/login', { data: { username: perpus.username, password: perpus.password } }));
  await k.cek('POST', '/api/perpus/login', await request.post('/api/perpus/login', { data: { username: perpus.username, password: 'salah' } })); // 401
  await k.cek('GET', '/api/perpus/me', await operatorApi.get('/api/perpus/me')); // OperatorMe
  const { member: rina, api: rinaApi } = await daftarAnggota('Rina');
  await k.cek('GET', '/api/perpus/me', await rinaApi.get('/api/perpus/me')); // MemberMe
  await k.cek('GET', '/api/perpus/members/{id}', await operatorApi.get(`/api/perpus/members/${rina.id}`));
  await k.cek('GET', '/api/perpus/books', await rinaApi.get('/api/perpus/books', { params: { page: 1, limit: 5 } }));
  await k.cek('POST', '/api/perpus/books', await rinaApi.post('/api/perpus/books', { data: {} })); // 403 reason role

  const pinjam = await rinaApi.post('/api/perpus/loans', { data: { bookId: 8, borrowedAt: daysAgo(10) } });
  await k.cek('POST', '/api/perpus/loans', pinjam); // 201 + Location
  const loanId = (await pinjam.json()).id;
  await k.cek('POST', '/api/perpus/loans/{id}/extend', await rinaApi.post(`/api/perpus/loans/${loanId}/extend`)); // 409 terlambat
  await k.cek('POST', '/api/perpus/loans/{id}/return', await operatorApi.post(`/api/perpus/loans/${loanId}/return`)); // 200
  await k.cek('GET', '/api/perpus/loans', await operatorApi.get('/api/perpus/loans', { params: { status: 'selesai' } }));
  await k.cek('GET', '/api/perpus/loans', await operatorApi.get('/api/perpus/loans', { params: { page: 1, limit: 5 } })); // dengan info halaman
  await k.cek('POST', '/api/perpus/members/{id}/pay-fines', await operatorApi.post(`/api/perpus/members/${rina.id}/pay-fines`)); // 200, denda terlambat tadi

  const antre = await rinaApi.post('/api/perpus/books/7/reservations'); // Lessons Learned: 0 eksemplar
  await k.cek('POST', '/api/perpus/books/{id}/reservations', antre); // 201 + Location
  const antreId = (await antre.json()).id;
  await k.cek('GET', '/api/perpus/reservations', await operatorApi.get('/api/perpus/reservations'));
  await k.cek('GET', '/api/perpus/reservations/{id}', await rinaApi.get(`/api/perpus/reservations/${antreId}`));
  await k.cek('DELETE', '/api/perpus/reservations/{id}', await rinaApi.delete(`/api/perpus/reservations/${antreId}`)); // 204

  const ulasan = await rinaApi.post('/api/perpus/books/13/reviews', { data: { rating: 5, comment: 'Praktis dan mudah diterapkan.' } });
  await k.cek('POST', '/api/perpus/books/{id}/reviews', ulasan); // 201 + Location
  const ulasanId = (await ulasan.json()).id;
  await k.cek('GET', '/api/perpus/books/{id}/reviews', await operatorApi.get('/api/perpus/books/13/reviews'));
  await k.cek('PATCH', '/api/perpus/reviews/{id}', await operatorApi.patch(`/api/perpus/reviews/${ulasanId}`, { data: { rating: 1 } })); // 403 role
  await k.cek('DELETE', '/api/perpus/reviews/{id}', await operatorApi.delete(`/api/perpus/reviews/${ulasanId}`)); // 204
  await k.cek('DELETE', '/api/perpus/members/{id}', await operatorApi.delete(`/api/perpus/members/${rina.id}`)); // 204
  await k.cek('POST', '/api/perpus/logout', await operatorApi.post('/api/perpus/logout')); // 204 tanpa body
});

test('kontrak: akun demo PerpusQA dikunci', async ({ request }) => {
  // Akun demo dipakai bersama semua orang, jadi mengubah atau menghapusnya dibalas 409.
  const k = await muatKontrak(request, 'perpusqa');
  const login = await request.post('/api/perpus/login', { data: { username: 'pustakawan', password: 'pustaka123' } });
  const headers = { Authorization: `Bearer ${(await login.json()).token}` };
  const { data } = await (await request.get('/api/perpus/members', { headers })).json();
  const anggota = data.find((m: { username: string }) => m.username === 'anggota');

  const ubah = await request.patch(`/api/perpus/members/${anggota.id}`, { headers, data: { status: 'Diblokir' } });
  await k.cek('PATCH', '/api/perpus/members/{id}', ubah);
  expect(ubah.status()).toBe(409);
  const hapus = await request.delete(`/api/perpus/members/${anggota.id}`, { headers });
  await k.cek('DELETE', '/api/perpus/members/{id}', hapus);
  expect(hapus.status()).toBe(409);
});

for (const proyek of ['tokoqa', 'klinikqa', 'perpusqa']) {
  // Dokumentasi juga harus jujur: setiap contoh respons di kontrak wajib lolos skemanya sendiri.
  test(`contoh di kontrak ${proyek} sesuai skemanya`, async ({ request }) => {
    const spec = await (await request.get(`/spec/${proyek}.json`)).json();
    const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
    const salah: string[] = [];
    for (const [path, item] of Object.entries<Record<string, { responses: Record<string, { content?: Record<string, { schema: object; example?: unknown }> }> }>>(spec.paths)) {
      for (const [method, operation] of Object.entries(item)) {
        for (const [status, response] of Object.entries(operation.responses)) {
          const content = response.content?.['application/json'];
          if (!content || content.example === undefined) continue;
          const validate = ajv.compile({ ...content.schema, components: spec.components });
          if (!validate(content.example)) salah.push(`${method.toUpperCase()} ${path} ${status}: ${ajv.errorsText(validate.errors)}`);
        }
      }
    }
    expect(salah).toEqual([]);
  });
}