// PerpusQA API: antrean buku yang habis, eksemplar yang disimpan untuk antrean, pengingat, dan pelunasan denda.
import { test, expect } from '../../fixtures';
import { daysAgo } from '../../pages/PerpusPage';

const KOSMOS = 10; // hanya 1 eksemplar
const LESSONS = 7; // 0 eksemplar

test('antre hanya kalau buku habis', async ({ anggotaApi }) => {
  const masihAda = await anggotaApi.post(`/api/perpus/books/${KOSMOS}/reservations`);
  expect(masihAda.status()).toBe(409);
  expect((await masihAda.json()).error).toBe('"Kosmos" masih tersedia 1 eksemplar. Langsung pinjam saja.');

  const antre = await anggotaApi.post(`/api/perpus/books/${LESSONS}/reservations`);
  expect(antre.status()).toBe(201);
  const body = await antre.json();
  expect(antre.headers()['location']).toBe(`/api/perpus/reservations/${body.id}`);
  expect([body.status, body.position]).toEqual(['Menunggu', 1]);
  expect((await anggotaApi.post(`/api/perpus/books/${LESSONS}/reservations`)).status()).toBe(409); // sudah antre
});

test('eksemplar yang kembali disimpan untuk antrean terdepan', async ({ operatorApi, daftarAnggota }) => {
  const { api: rina } = await daftarAnggota('Rina');
  const { api: budi } = await daftarAnggota('Budi');
  const { api: sari } = await daftarAnggota('Sari');
  const pinjamanRina = await (await rina.post('/api/perpus/loans', { data: { bookId: KOSMOS } })).json();
  const antreBudi = await (await budi.post(`/api/perpus/books/${KOSMOS}/reservations`)).json();
  const antreSari = await (await sari.post(`/api/perpus/books/${KOSMOS}/reservations`)).json();
  expect([antreBudi.position, antreSari.position]).toEqual([1, 2]);
  expect((await (await operatorApi.get(`/api/perpus/books/${KOSMOS}`)).json()).queue).toBe(2);

  await operatorApi.post(`/api/perpus/loans/${pinjamanRina.id}/return`);
  const siap = await (await budi.get(`/api/perpus/reservations/${antreBudi.id}`)).json();
  expect([siap.status, siap.position]).toEqual(['Siap diambil', null]);
  expect((await (await sari.get(`/api/perpus/reservations/${antreSari.id}`)).json()).position).toBe(1); // naik satu

  // Eksemplar itu disimpan untuk Budi: Sari yang masih antre ditolak dengan posisi antreannya
  const ditolak = await sari.post('/api/perpus/loans', { data: { bookId: KOSMOS } });
  expect(ditolak.status()).toBe(409);
  expect((await ditolak.json()).error).toBe('Kamu antrean ke-1 untuk "Kosmos". Tunggu sampai statusnya Siap diambil.');

  expect((await budi.post('/api/perpus/loans', { data: { bookId: KOSMOS } })).status()).toBe(201);
  expect((await (await budi.get(`/api/perpus/reservations/${antreBudi.id}`)).json()).status).toBe('Selesai');
});

test('batal antrean memberi giliran ke berikutnya', async ({ operatorApi, daftarAnggota }) => {
  const { api: rina } = await daftarAnggota('Rina');
  const { api: budi } = await daftarAnggota('Budi');
  const pertama = await (await rina.post(`/api/perpus/books/${LESSONS}/reservations`)).json();
  const kedua = await (await budi.post(`/api/perpus/books/${LESSONS}/reservations`)).json();

  await operatorApi.patch(`/api/perpus/books/${LESSONS}`, { data: { copies: 1 } }); // pustakawan menambah eksemplar
  expect((await (await rina.get(`/api/perpus/reservations/${pertama.id}`)).json()).status).toBe('Siap diambil');

  expect((await rina.delete(`/api/perpus/reservations/${pertama.id}`)).status()).toBe(204);
  expect((await (await budi.get(`/api/perpus/reservations/${kedua.id}`)).json()).status).toBe('Siap diambil');
  expect((await rina.delete(`/api/perpus/reservations/${pertama.id}`)).status()).toBe(409); // sudah dibatalkan
  expect((await rina.get(`/api/perpus/reservations/${kedua.id}`)).status()).toBe(404); // milik anggota lain
});

test('batas dua antrean', async ({ operatorApi, anggotaApi }) => {
  for (const id of [3, 6]) { // Cantik Itu Luka dan Testing Computer Software, masing-masing 1 eksemplar
    await operatorApi.patch(`/api/perpus/books/${id}`, { data: { copies: 0 } });
  }
  expect((await anggotaApi.post(`/api/perpus/books/${LESSONS}/reservations`)).status()).toBe(201);
  expect((await anggotaApi.post('/api/perpus/books/3/reservations')).status()).toBe(201);
  const ketiga = await anggotaApi.post('/api/perpus/books/6/reservations');
  expect(ketiga.status()).toBe(409);
  expect((await ketiga.json()).error).toContain('Batas antre 2 buku');
});

test('sisa hari untuk pengingat', async ({ anggotaApi }) => {
  const besok = await (await anggotaApi.post('/api/perpus/loans', { data: { bookId: 4, borrowedAt: daysAgo(6) } })).json();
  const terlambat = await (await anggotaApi.post('/api/perpus/loans', { data: { bookId: 5, borrowedAt: daysAgo(9) } })).json();
  expect(besok.daysLeft).toBe(1);
  expect([terlambat.daysLeft, terlambat.lateDays, terlambat.fine]).toEqual([-2, 2, 2000]);
});

test('pustakawan melunasi denda', async ({ operatorApi, daftarAnggota }) => {
  const { member: rina, api: rinaApi } = await daftarAnggota('Rina');
  const pinjam = await (await rinaApi.post('/api/perpus/loans', { data: { bookId: 13, borrowedAt: daysAgo(10) } })).json();
  await operatorApi.post(`/api/perpus/loans/${pinjam.id}/return`); // terlambat 3 hari
  expect((await (await rinaApi.get('/api/perpus/me')).json()).unpaidFine).toBe(3000);

  expect((await rinaApi.post(`/api/perpus/members/${rina.id}/pay-fines`)).status()).toBe(403); // anggota tidak bisa melunasi sendiri
  const bayar = await operatorApi.post(`/api/perpus/members/${rina.id}/pay-fines`);
  expect(bayar.status()).toBe(200);
  const struk = await bayar.json();
  expect([struk.paid, struk.loans]).toEqual([3000, [pinjam.id]]);
  expect([struk.member.unpaidFine, struk.member.totalFine]).toEqual([0, 3000]);
  expect((await (await rinaApi.get(`/api/perpus/loans/${pinjam.id}`)).json()).finePaid).toBe(true);
  expect((await operatorApi.post(`/api/perpus/members/${rina.id}/pay-fines`)).status()).toBe(409); // tidak ada lagi yang dibayar
});

test('cari dan paginasi pinjaman', async ({ operatorApi, daftarAnggota }) => {
  const { api: rina } = await daftarAnggota('Rina');
  for (const bookId of [1, 2, 4]) await rina.post('/api/perpus/loans', { data: { bookId } });
  const halaman = await (await operatorApi.get('/api/perpus/loans', { params: { page: 2, limit: 2 } })).json();
  expect([halaman.total, halaman.totalPages, halaman.data.length]).toEqual([3, 2, 1]);
  const cari = await (await operatorApi.get('/api/perpus/loans', { params: { q: 'clean' } })).json();
  expect(cari.data.map((p: { title: string }) => p.title)).toEqual(['Clean Code']);
});