// PerpusQA API: empat studi kasus. Login username + password memberi token (JWT) untuk header Authorization.
// Setiap test membuka perpustakaannya sendiri (fixture perpus), jadi katalog, anggota, pinjaman, dan ulasannya
// tidak tercampur dengan test lain walau berjalan bersamaan.
import { test, expect } from '../../fixtures';
import { daysAgo, usernameUnik } from '../../pages/PerpusPage';
import { loginPerpus } from '../../utils/perpus-api';

const BUKU_BARU = { title: 'Software Testing', author: 'Ron Patton', year: 2005, category: 'Teknologi', copies: 1 };

test.describe('Studi kasus 1: login, peran, dan isolasi data', () => {
  test('login memberi token dan logout mengakhirinya', async ({ request }) => {
    const login = await request.post('/api/perpus/login', { data: { username: 'anggota', password: 'baca123' } });
    expect(login.status()).toBe(200);
    const body = await login.json();
    expect(body.token.split('.')).toHaveLength(3); // JWT: header.payload.signature
    expect(body.user).toMatchObject({ role: 'anggota', name: 'Rina' });

    const auth = { Authorization: `Bearer ${body.token}` };
    expect((await request.get('/api/perpus/me', { headers: auth })).status()).toBe(200);
    expect((await request.post('/api/perpus/logout', { headers: auth })).status()).toBe(204);
    const setelah = await request.get('/api/perpus/me', { headers: auth });
    expect(setelah.status()).toBe(401);
    expect((await setelah.json()).reason).toBe('invalid'); // token lama tidak berlaku lagi
  });

  test('login gagal dan tanpa token', async ({ request }) => {
    expect((await request.post('/api/perpus/login', { data: { username: 'anggota', password: 'salah' } })).status()).toBe(401);
    expect((await request.post('/api/perpus/login', { data: { username: 'anggota' } })).status()).toBe(400);

    const tanpaToken = await request.get('/api/perpus/me');
    expect(tanpaToken.status()).toBe(401);
    expect((await tanpaToken.json()).reason).toBe('missing');
    expect((await (await request.get('/api/perpus/me', { headers: { Authorization: 'Bearer bukan-token-asli' } })).json()).reason).toBe('invalid');
  });

  test('profil berbeda untuk setiap peran', async ({ operatorApi, anggotaApi }) => {
    const pustakawan = await (await operatorApi.get('/api/perpus/me')).json();
    expect(pustakawan).toMatchObject({ role: 'operator', name: 'Sari' });

    const anggota = await (await anggotaApi.get('/api/perpus/me')).json();
    expect(anggota).toMatchObject({ role: 'anggota', status: 'Aktif', limit: 3, activeLoans: 0 });
    expect(anggota.library).toEqual(pustakawan.library); // satu perpustakaan yang sama
  });

  test('peran yang tidak berhak ditolak 403', async ({ operatorApi, anggotaApi }) => {
    for (const res of [await anggotaApi.post('/api/perpus/books', { data: BUKU_BARU }), await anggotaApi.get('/api/perpus/members')]) {
      expect(res.status()).toBe(403);
      expect((await res.json()).reason).toBe('role');
    }
    expect((await (await operatorApi.post('/api/perpus/loans', { data: { bookId: 1 } })).json()).reason).toBe('role');
    const pinjam = await (await anggotaApi.post('/api/perpus/loans', { data: { bookId: 1 } })).json();
    const kembali = await anggotaApi.post(`/api/perpus/loans/${pinjam.id}/return`);
    expect(kembali.status()).toBe(403);
    expect((await kembali.json()).error).toContain('pustakawan');
  });

  test('data anggota lain dan perpustakaan lain tidak terlihat', async ({ request, playwright, baseURL, operatorApi, daftarAnggota }) => {
    const { api: rina } = await daftarAnggota('Rina');
    const { api: budi } = await daftarAnggota('Budi');
    const pinjam = await (await rina.post('/api/perpus/loans', { data: { bookId: 3 } })).json();

    expect((await budi.get(`/api/perpus/loans/${pinjam.id}`)).status()).toBe(404); // anggota lain
    expect((await operatorApi.get(`/api/perpus/loans/${pinjam.id}`)).status()).toBe(200); // pustakawan melihat semua

    // Perpustakaan lain = sandbox lain: pinjamannya tidak ada, stoknya tidak terpengaruh
    const akun = { username: usernameUnik('lain'), password: 'rahasia123' };
    await request.post('/api/perpus/libraries', { data: { name: 'Perpustakaan Lain', ...akun } });
    const operatorLain = await loginPerpus(playwright, baseURL, akun.username, akun.password);
    expect((await operatorLain.get(`/api/perpus/loans/${pinjam.id}`)).status()).toBe(404);
    expect((await (await operatorApi.get('/api/perpus/books/3')).json()).available).toBe(0);
    expect((await (await operatorLain.get('/api/perpus/books/3')).json()).available).toBe(1);
    await operatorLain.dispose();
  });
});

test.describe('Studi kasus 2: CRUD per peran (katalog, anggota, ulasan)', () => {
  test('CRUD buku', async ({ operatorApi }) => {
    const dibuat = await operatorApi.post('/api/perpus/books', { data: BUKU_BARU });
    expect(dibuat.status()).toBe(201);
    const buku = await dibuat.json();
    expect(buku.id).toBe(15); // melanjutkan 14 buku contoh
    expect(dibuat.headers()['location']).toBe(`/api/perpus/books/${buku.id}`);
    expect(await (await operatorApi.get(dibuat.headers()['location'])).json()).toEqual(buku);

    const diubah = await operatorApi.patch(`/api/perpus/books/${buku.id}`, { data: { copies: 3 } });
    expect(await diubah.json()).toMatchObject({ copies: 3, available: 3, title: BUKU_BARU.title });

    expect((await operatorApi.delete(`/api/perpus/books/${buku.id}`)).status()).toBe(204);
    expect((await operatorApi.get(`/api/perpus/books/${buku.id}`)).status()).toBe(404);
  });

  test('validasi dan judul dobel', async ({ operatorApi }) => {
    const salah = await operatorApi.post('/api/perpus/books', { data: { title: '', author: 'X', year: 3000, category: 'Komik', copies: -1, warna: 'biru' } });
    expect(salah.status()).toBe(422);
    expect(Object.keys((await salah.json()).fields).sort()).toEqual(['author', 'category', 'copies', 'title', 'warna', 'year']);
    const dobel = await operatorApi.post('/api/perpus/books', { data: { ...BUKU_BARU, title: 'laskar pelangi', author: 'ANDREA HIRATA' } });
    expect(dobel.status()).toBe(409);
  });

  test('buku yang sedang dipinjam dilindungi', async ({ operatorApi, anggotaApi }) => {
    await anggotaApi.post('/api/perpus/loans', { data: { bookId: 13 } }); // Atomic Habits, 2 eksemplar
    expect((await operatorApi.delete('/api/perpus/books/13')).status()).toBe(409);
    const kurangi = await operatorApi.patch('/api/perpus/books/13', { data: { copies: 0 } });
    expect(kurangi.status()).toBe(409);
    expect((await kurangi.json()).error).toContain('minimal 1');
  });

  test('CRUD anggota', async ({ request, operatorApi }) => {
    const akun = { username: usernameUnik('dewi'), password: 'baca123' };
    const dibuat = await operatorApi.post('/api/perpus/members', { data: { name: 'Dewi', ...akun } });
    expect(dibuat.status()).toBe(201);
    const dewi = await dibuat.json();
    expect(dibuat.headers()['location']).toBe(`/api/perpus/members/${dewi.id}`);
    expect(dewi).toMatchObject({ username: akun.username, status: 'Aktif' });
    expect((await operatorApi.post('/api/perpus/members', { data: { name: 'Dewi Dobel', ...akun } })).status()).toBe(409); // username dipakai

    const diubah = await operatorApi.patch(`/api/perpus/members/${dewi.id}`, { data: { name: 'Dewi Lestari', password: 'baru1234' } });
    expect((await diubah.json()).name).toBe('Dewi Lestari');
    expect((await request.post('/api/perpus/login', { data: { ...akun, password: 'baru1234' } })).status()).toBe(200); // password baru berlaku

    expect((await operatorApi.delete(`/api/perpus/members/${dewi.id}`)).status()).toBe(204);
    expect((await operatorApi.get(`/api/perpus/members/${dewi.id}`)).status()).toBe(404);
    expect((await request.post('/api/perpus/login', { data: { ...akun, password: 'baru1234' } })).status()).toBe(401); // akunnya ikut terhapus
  });

  test('anggota yang masih meminjam tidak bisa dihapus', async ({ operatorApi, daftarAnggota }) => {
    const { member: rina, api: rinaApi } = await daftarAnggota('Rina');
    await rinaApi.post('/api/perpus/loans', { data: { bookId: 1 } });
    const hapus = await operatorApi.delete(`/api/perpus/members/${rina.id}`);
    expect(hapus.status()).toBe(409);
    expect((await hapus.json()).error).toContain('masih meminjam');
  });

  test('CRUD ulasan', async ({ operatorApi, daftarAnggota }) => {
    const { api: rina } = await daftarAnggota('Rina');
    const { api: budi } = await daftarAnggota('Budi');

    const dibuat = await rina.post('/api/perpus/books/13/reviews', { data: { rating: 5, comment: 'Praktis dan mudah diterapkan.' } });
    expect(dibuat.status()).toBe(201);
    const ulasan = await dibuat.json();
    expect(dibuat.headers()['location']).toBe(`/api/perpus/reviews/${ulasan.id}`);
    expect((await rina.post('/api/perpus/books/13/reviews', { data: { rating: 4, comment: 'Ulasan kedua.' } })).status()).toBe(409);

    // Ulasan bisa dibaca semua orang, tapi hanya pemiliknya yang boleh mengubah
    expect((await budi.get(`/api/perpus/reviews/${ulasan.id}`)).status()).toBe(200);
    for (const res of [await budi.patch(`/api/perpus/reviews/${ulasan.id}`, { data: { rating: 1 } }), await budi.delete(`/api/perpus/reviews/${ulasan.id}`)]) {
      expect(res.status()).toBe(403);
      expect((await res.json()).reason).toBe('owner');
    }
    expect((await (await rina.patch(`/api/perpus/reviews/${ulasan.id}`, { data: { rating: 4 } })).json()).rating).toBe(4);
    expect((await (await rina.get('/api/perpus/books/13')).json()).rating).toBe(4);

    // Pustakawan tidak mengubah ulasan, tapi boleh menghapus (moderasi)
    expect((await (await operatorApi.patch(`/api/perpus/reviews/${ulasan.id}`, { data: { rating: 5 } })).json()).reason).toBe('role');
    expect((await operatorApi.delete(`/api/perpus/reviews/${ulasan.id}`)).status()).toBe(204);
    expect((await rina.get(`/api/perpus/reviews/${ulasan.id}`)).status()).toBe(404);
  });
});

test.describe('Studi kasus 3: aturan peminjaman', () => {
  test('pinjam buku dapat 201 dan Location', async ({ anggotaApi }) => {
    const res = await anggotaApi.post('/api/perpus/loans', { data: { bookId: 1 } });
    expect(res.status()).toBe(201);
    const pinjam = await res.json();
    expect(res.headers()['location']).toBe(`/api/perpus/loans/${pinjam.id}`);
    expect(pinjam).toMatchObject({ status: 'Dipinjam', extended: false, memberName: 'Rina', borrowedAt: daysAgo(0), dueDate: daysAgo(-7) });
  });

  test('buku yang sama dan batas tiga buku', async ({ anggotaApi }) => {
    expect((await anggotaApi.post('/api/perpus/loans', { data: { bookId: 1 } })).status()).toBe(201);
    const dobel = await anggotaApi.post('/api/perpus/loans', { data: { bookId: 1 } });
    expect(dobel.status()).toBe(409);
    expect((await dobel.json()).error).toContain('sedang meminjam');

    for (const bookId of [2, 4]) expect((await anggotaApi.post('/api/perpus/loans', { data: { bookId } })).status()).toBe(201);
    const keempat = await anggotaApi.post('/api/perpus/loans', { data: { bookId: 5 } });
    expect(keempat.status()).toBe(409);
    expect((await keempat.json()).error).toContain('Batas pinjam 3 buku');
  });

  test('stok habis berlaku untuk seluruh perpustakaan', async ({ operatorApi, daftarAnggota }) => {
    const buku = await (await operatorApi.post('/api/perpus/books', { data: BUKU_BARU })).json(); // 1 eksemplar, milik test ini saja
    const { api: rina } = await daftarAnggota('Rina');
    const { api: budi } = await daftarAnggota('Budi');

    expect((await rina.post('/api/perpus/loans', { data: { bookId: buku.id } })).status()).toBe(201);
    const habis = await budi.post('/api/perpus/loans', { data: { bookId: buku.id } });
    expect(habis.status()).toBe(409);
    expect((await habis.json()).error).toContain('Semua eksemplar');
  });

  test('kartu diblokir tidak bisa meminjam', async ({ operatorApi, daftarAnggota }) => {
    const { member: budi, api: budiApi } = await daftarAnggota('Budi');
    await operatorApi.patch(`/api/perpus/members/${budi.id}`, { data: { status: 'Diblokir' } });

    const ditolak = await budiApi.post('/api/perpus/loans', { data: { bookId: 1 } });
    expect(ditolak.status()).toBe(403);
    expect((await ditolak.json()).reason).toBe('blocked'); // beda dengan reason role

    await operatorApi.patch(`/api/perpus/members/${budi.id}`, { data: { status: 'Aktif' } });
    expect((await budiApi.post('/api/perpus/loans', { data: { bookId: 1 } })).status()).toBe(201);
  });

  test('validasi per field dan buku tidak ada', async ({ anggotaApi }) => {
    const res = await anggotaApi.post('/api/perpus/loans', { data: { bookId: '1', borrowedAt: 'besok', catatan: 'titip' } });
    expect(res.status()).toBe(422);
    expect(Object.keys((await res.json()).fields).sort()).toEqual(['bookId', 'borrowedAt', 'catatan']);
    expect((await anggotaApi.post('/api/perpus/loans', { data: { bookId: 999 } })).status()).toBe(404);
  });

  test('perpanjangan hanya sekali dan tidak untuk yang terlambat', async ({ anggotaApi }) => {
    const pinjam = await (await anggotaApi.post('/api/perpus/loans', { data: { bookId: 1 } })).json();
    const panjang = await anggotaApi.post(`/api/perpus/loans/${pinjam.id}/extend`);
    expect(await panjang.json()).toMatchObject({ dueDate: daysAgo(-14), extended: true });
    expect((await anggotaApi.post(`/api/perpus/loans/${pinjam.id}/extend`)).status()).toBe(409);

    const telat = await (await anggotaApi.post('/api/perpus/loans', { data: { bookId: 2, borrowedAt: daysAgo(10) } })).json();
    const ditolak = await anggotaApi.post(`/api/perpus/loans/${telat.id}/extend`);
    expect(ditolak.status()).toBe(409);
    expect((await ditolak.json()).error).toContain('lewat jatuh tempo');
  });

  test('pengembalian ganda ditolak', async ({ operatorApi, anggotaApi }) => {
    const pinjam = await (await anggotaApi.post('/api/perpus/loans', { data: { bookId: 12 } })).json();
    const kembali = await operatorApi.post(`/api/perpus/loans/${pinjam.id}/return`);
    expect(kembali.status()).toBe(200);
    expect(await kembali.json()).toMatchObject({ status: 'Dikembalikan', fine: 0 });
    expect((await operatorApi.post(`/api/perpus/loans/${pinjam.id}/return`)).status()).toBe(409);
  });
});

test.describe('Studi kasus 4: denda, dua peran, API dan UI', () => {
  test('denda dua peran API dan UI', async ({ perpus, anggotaApi, operatorApi, perpusMasuk, perpusOperator }) => {
    // 1. API (anggota): pinjam dengan tanggal mundur 10 hari, jadi sudah lewat jatuh tempo 3 hari
    const pinjam = await (await anggotaApi.post('/api/perpus/loans', { data: { bookId: 8, borrowedAt: daysAgo(10) } })).json();
    expect(pinjam).toMatchObject({ dueDate: daysAgo(3), lateDays: 3 });

    // 2. UI (pustakawan): login, lalu cek status di tab Pinjaman
    await perpusMasuk.login(perpus.username, perpus.password);
    const baris = perpusOperator.loanRow(pinjam.id);
    await expect(baris.getByTestId('loan-status')).toHaveText('Terlambat 3 hari, denda Rp 3.000');
    await expect(perpusOperator.statLate).toHaveText('1');

    // 3. UI (pustakawan): terima pengembalian lewat modal konfirmasi
    await perpusOperator.receive(pinjam.id);
    await expect(baris).toHaveCount(0); // filter default hanya menampilkan yang sedang dipinjam

    // 4. API (dua peran): denda tercatat di pinjaman, di profil anggota, dan di data anggota milik pustakawan
    expect((await (await anggotaApi.get(`/api/perpus/loans/${pinjam.id}`)).json()).fine).toBe(3000);
    expect((await (await anggotaApi.get('/api/perpus/me')).json()).totalFine).toBe(3000);
    expect((await (await operatorApi.get(`/api/perpus/members/${pinjam.memberId}`)).json()).totalFine).toBe(3000);
  });
});