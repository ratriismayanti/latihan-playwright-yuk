// KlinikQA API: empat studi kasus. Login memberi token (JWT) yang dikirim di header Authorization.
import { test, expect } from '@playwright/test';
import { nextOpenDay, nextSunday } from '../../pages/KlinikPage';
import { loginKlinik } from '../../utils/klinik-api';

const loginSebagai = loginKlinik; // request context yang mengirim token di setiap request

test.describe('Studi kasus 1: token sesi', () => {
  test('login memberi token', async ({ request }) => {
    const res = await request.post('/api/klinik/login', { data: { username: 'pasien', password: 'sehat123' } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token.split('.')).toHaveLength(3); // JWT: header.payload.signature
    expect(body.expiresIn).toBe(8 * 60 * 60);      // berlaku 8 jam
    expect(body.user.role).toBe('pasien');
  });

  test('logout mengakhiri sesi', async ({ baseURL }) => {
    const pasien = await loginSebagai(baseURL, 'pasien', 'sehat123');
    expect((await (await pasien.get('/api/klinik/me')).json()).name).toBe('Budi Santoso');
    expect((await pasien.post('/api/klinik/logout')).status()).toBe(204);
    const res = await pasien.get('/api/klinik/me'); // token yang sama masih dikirim
    expect(res.status()).toBe(401);
    expect((await res.json()).reason).toBe('invalid'); // tapi sesinya sudah dimatikan server
    await pasien.dispose();
  });

  test('tanpa token dan token palsu ditolak', async ({ request }) => {
    const tanpa = await request.get('/api/klinik/me');
    expect([tanpa.status(), (await tanpa.json()).reason]).toEqual([401, 'missing']);
    const palsu = await request.get('/api/klinik/me', { headers: { Authorization: 'Bearer bukan-token-asli' } });
    expect([palsu.status(), (await palsu.json()).reason]).toEqual([401, 'invalid']);
  });

  test('token TokoQA tidak berlaku di KlinikQA', async ({ request }) => {
    const { token } = await (await request.post('/api/login', { data: { username: 'customer', password: 'rahasia123' } })).json();
    const res = await request.get('/api/klinik/me', { headers: { Authorization: `Bearer ${token}` } });
    expect([res.status(), (await res.json()).reason]).toEqual([401, 'invalid']); // token milik aplikasi lain
  });
});

test.describe('Studi kasus 2: slot bentrok dan validasi', () => {
  test('slot penuh dan slot bentrok', async ({ baseURL }) => {
    const pasien = await loginSebagai(baseURL, 'pasien', 'sehat123');
    const tanggal = nextOpenDay(5);
    const { slots } = await (await pasien.get('/api/klinik/slots', { params: { doctorId: 1, date: tanggal } })).json();
    expect(slots).toContainEqual({ time: '09:00', queueNo: 'U-03', available: false, reason: 'penuh' }); // sudah dipesan pasien lain

    const janji = { doctorId: 1, date: tanggal, time: '14:00', complaint: 'Kontrol tekanan darah' };
    const dibuat = await pasien.post('/api/klinik/appointments', { data: janji });
    expect(dibuat.status()).toBe(201);
    expect(dibuat.headers()['location']).toBe(`/api/klinik/appointments/${(await dibuat.json()).id}`);
    expect((await pasien.post('/api/klinik/appointments', { data: janji })).status()).toBe(409);
    await pasien.dispose();
  });

  test('validasi per field', async ({ baseURL }) => {
    const pasien = await loginSebagai(baseURL, 'pasien', 'sehat123');
    const res = await pasien.post('/api/klinik/appointments', {
      data: { doctorId: 9, date: nextSunday(), time: '07:00', complaint: 'pusing' },
    });
    expect(res.status()).toBe(422);
    const { fields } = await res.json();
    expect(Object.keys(fields).sort()).toEqual(['complaint', 'date', 'doctorId', 'time']);
    expect(fields.date).toContain('Minggu');
    await pasien.dispose();
  });
});

test.describe('Studi kasus 3: hak akses pasien vs dokter', () => {
  test('pasien dan dokter punya hak berbeda', async ({ baseURL }) => {
    const pasien = await loginSebagai(baseURL, 'pasien', 'sehat123');
    const dokter = await loginSebagai(baseURL, 'dokter', 'dokter123');
    const janji = await (await pasien.post('/api/klinik/appointments', {
      data: { doctorId: 1, date: nextOpenDay(6), time: '08:30', complaint: 'Batuk dan pilek tiga hari' },
    })).json();

    expect((await dokter.post('/api/klinik/appointments', { data: {} })).status()).toBe(403); // dokter tidak membuat janji
    expect((await pasien.patch(`/api/klinik/appointments/${janji.id}`, { data: { status: 'Selesai' } })).status()).toBe(403);

    const { data: jadwal } = await (await dokter.get('/api/klinik/appointments')).json();
    expect(jadwal.some((a: { id: string }) => a.id === janji.id)).toBeTruthy(); // dokter melihat janji pasien

    const selesai = await dokter.patch(`/api/klinik/appointments/${janji.id}`, { data: { status: 'Selesai' } });
    expect((await selesai.json()).status).toBe('Selesai');
    expect((await pasien.delete(`/api/klinik/appointments/${janji.id}`)).status()).toBe(409); // sudah selesai
    await pasien.dispose();
    await dokter.dispose();
  });
});

test.describe('CRUD: pasien mengubah jadwal, dokter menulis catatan', () => {
  test('pasien mengubah jadwal', async ({ baseURL }) => {
    const pasien = await loginSebagai(baseURL, 'pasien', 'sehat123');
    const janji = await (await pasien.post('/api/klinik/appointments', { data: { doctorId: 1, date: nextOpenDay(10), time: '08:00', complaint: 'Kontrol gula darah rutin' } })).json();
    const url = `/api/klinik/appointments/${janji.id}`;

    const ubah = await pasien.patch(url, { data: { time: '13:00', complaint: 'Kontrol gula darah dan kolesterol' } });
    expect(ubah.status()).toBe(200);
    expect(await ubah.json()).toMatchObject({ time: '13:00', date: janji.date }); // tanggal tidak ikut berubah

    expect((await pasien.patch(url, { data: { time: '09:00' } })).status()).toBe(409); // slot contoh yang selalu penuh
    const gantiDokter = await pasien.patch(url, { data: { doctorId: 2 } });
    expect(gantiDokter.status()).toBe(422);
    expect((await gantiDokter.json()).fields.doctorId).toContain('Batalkan');
    expect((await pasien.patch(url, { data: { status: 'Selesai' } })).status()).toBe(403); // menandai hasil itu tugas dokter
    await pasien.dispose();
  });

  test('catatan pemeriksaan CRUD', async ({ baseURL }) => {
    const pasien = await loginSebagai(baseURL, 'pasien', 'sehat123');
    const dokter = await loginSebagai(baseURL, 'dokter', 'dokter123');
    const janji = await (await pasien.post('/api/klinik/appointments', { data: { doctorId: 1, date: nextOpenDay(11), time: '10:30', complaint: 'Batuk berdahak seminggu' } })).json();
    const catatanUrl = `/api/klinik/appointments/${janji.id}/notes`;

    expect((await pasien.post(catatanUrl, { data: { kind: 'Saran', text: 'Saya tulis sendiri' } })).status()).toBe(403);
    const dibuat = await dokter.post(catatanUrl, { data: { kind: 'Diagnosis', text: 'Bronkitis akut ringan.' } });
    expect(dibuat.status()).toBe(201);
    const catatan = await dibuat.json();
    expect(dibuat.headers()['location']).toBe(`/api/klinik/notes/${catatan.id}`);
    expect((await (await pasien.get(catatanUrl)).json()).data[0].text).toBe('Bronkitis akut ringan.'); // pasien bisa membaca

    const ubah = await dokter.patch(`/api/klinik/notes/${catatan.id}`, { data: { text: 'Bronkitis akut ringan, kontrol 3 hari lagi.' } });
    expect((await ubah.json()).text).toMatch(/kontrol 3 hari lagi\.$/);
    expect((await dokter.delete(`/api/klinik/notes/${catatan.id}`)).status()).toBe(204);
    expect((await dokter.get(`/api/klinik/notes/${catatan.id}`)).status()).toBe(404);
    await pasien.dispose();
    await dokter.dispose();
  });

  test('janji yang dibatalkan tidak bisa diberi catatan', async ({ baseURL }) => {
    const pasien = await loginSebagai(baseURL, 'pasien', 'sehat123');
    const dokter = await loginSebagai(baseURL, 'dokter', 'dokter123');
    const janji = await (await pasien.post('/api/klinik/appointments', { data: { doctorId: 1, date: nextOpenDay(12), time: '14:30', complaint: 'Sakit kepala sebelah' } })).json();
    await pasien.delete(`/api/klinik/appointments/${janji.id}`);
    expect((await dokter.post(`/api/klinik/appointments/${janji.id}/notes`, { data: { kind: 'Saran', text: 'Istirahat cukup.' } })).status()).toBe(409);
    await pasien.dispose();
    await dokter.dispose();
  });
});