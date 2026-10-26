// KlinikQA API: nomor antrean, kalender slot, batas ubah jadwal, agenda dokter, dan data pasien.
import { test, expect, type APIRequestContext } from '@playwright/test';
import { nextOpenDay, nextSaturday, nextSunday } from '../../pages/KlinikPage';
import { loginKlinik } from '../../utils/klinik-api';

type Janji = { id: string; date: string; time: string; status: string; queueNo: string; room: string; createdAt: string; history: unknown[] };

const loginSebagai = loginKlinik; // request context yang mengirim token di setiap request

async function buatJanji(pasien: APIRequestContext, date: string, time: string, complaint = 'Demam sejak dua hari yang lalu', doctorId = 1): Promise<Janji> {
  const res = await pasien.post('/api/klinik/appointments', { data: { doctorId, date, time, complaint } });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

let pasien: APIRequestContext;
let dokter: APIRequestContext;
test.beforeEach(async ({ baseURL }) => {
  pasien = await loginSebagai(baseURL, 'pasien', 'sehat123');
  dokter = await loginSebagai(baseURL, 'dokter', 'dokter123');
});
test.afterEach(async () => {
  await pasien.dispose();
  await dokter.dispose();
});

test('nomor antrean mengikuti urutan jam', async () => {
  const janji = await buatJanji(pasien, nextOpenDay(3), '10:00');
  expect(janji.queueNo).toBe('U-05'); // 10:00 adalah slot ke-5, awalan U untuk dokter umum
  expect(janji.room).toBe('Poli Umum, Ruang 1');
  expect(janji.history).toEqual([{ event: 'Dibuat', at: janji.createdAt, by: 'pasien', detail: null }]);

  const anak = await buatJanji(pasien, nextOpenDay(3), '13:00', 'Anak demam dan batuk sejak kemarin', 2);
  expect(anak.queueNo).toBe('A-07');
});

test('kalender menandai Minggu tutup dan Sabtu penuh', async ({ request }) => {
  const kalender = await (await request.get('/api/klinik/calendar', { params: { doctorId: 3 } })).json();
  const hari = Object.fromEntries(kalender.days.map((d: { date: string }) => [d.date, d]));
  expect(kalender.days).toHaveLength(31); // hari ini sampai 30 hari ke depan
  expect(hari[nextSunday()]).toEqual({ date: nextSunday(), status: 'tutup', available: 0 });
  expect(hari[nextSaturday()].status).toBe('penuh'); // drg. Maya selalu penuh di hari Sabtu

  expect((await request.get('/api/klinik/calendar', { params: { doctorId: 9 } })).status()).toBe(400);
});

test('Sabtu drg. Maya ditolak', async () => {
  const res = await pasien.post('/api/klinik/appointments', { data: { doctorId: 3, date: nextSaturday(), time: '10:00', complaint: 'Gigi berlubang terasa ngilu' } });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toBe('drg. Maya Putri sudah penuh di tanggal itu. Pilih tanggal lain.');
});

test('jadwal hanya bisa diubah dua kali', async () => {
  const janji = await buatJanji(pasien, nextOpenDay(4), '08:00');
  const url = `/api/klinik/appointments/${janji.id}`;

  const pertama = await (await pasien.patch(url, { data: { time: '08:30' } })).json();
  expect([pertama.queueNo, pertama.rescheduleCount]).toEqual(['U-02', 1]); // nomor antrean ikut berubah
  expect(pertama.history.at(-1).detail).toBe(`Dari ${janji.date} 08:00 ke ${janji.date} 08:30`);

  expect((await (await pasien.patch(url, { data: { complaint: 'Demam dan batuk sejak dua hari' } })).json()).rescheduleCount).toBe(1); // keluhan tidak dihitung
  expect((await (await pasien.patch(url, { data: { date: nextOpenDay(6) } })).json()).rescheduleCount).toBe(2);

  const ketiga = await pasien.patch(url, { data: { time: '10:00' } });
  expect(ketiga.status()).toBe(409);
  expect((await ketiga.json()).error).toBe('Jadwal janji temu ini sudah diubah 2 kali. Batalkan lalu buat janji baru.');
});

test('agenda dokter dan ringkasannya', async () => {
  const tanggal = nextOpenDay(13);
  const a = await buatJanji(pasien, tanggal, '08:00', 'Kontrol tekanan darah rutin');
  const b = await buatJanji(pasien, tanggal, '08:30', 'Nyeri lutut setelah olahraga');
  const c = await buatJanji(pasien, tanggal, '10:00', 'Sakit kepala sejak pagi');
  await dokter.patch(`/api/klinik/appointments/${a.id}`, { data: { status: 'Selesai' } });
  await dokter.patch(`/api/klinik/appointments/${b.id}`, { data: { status: 'Tidak hadir' } });
  await pasien.delete(`/api/klinik/appointments/${c.id}`);

  const agenda = await (await dokter.get('/api/klinik/agenda', { params: { date: tanggal } })).json();
  const status = Object.fromEntries(agenda.data.map((x: Janji) => [x.id, x.status]));
  expect([status[a.id], status[b.id], status[c.id]]).toEqual(['Selesai', 'Tidak hadir', 'Dibatalkan']);
  expect(agenda.open).toBe(true);

  // Sesi lain (atau test di browser lain) mungkin juga punya janji di tanggal ini,
  // jadi ringkasannya dicocokkan dengan isi agenda di respons yang sama.
  const hitung = (s: string) => agenda.data.filter((x: Janji) => x.status === s).length;
  expect(agenda.summary).toEqual({
    patients: agenda.data.length - hitung('Dibatalkan'), // yang dibatalkan tidak dihitung sebagai pasien
    waiting: hitung('Terjadwal'), done: hitung('Selesai'), noShow: hitung('Tidak hadir'), cancelled: hitung('Dibatalkan'),
  });

  const selesai = await (await dokter.get('/api/klinik/agenda', { params: { date: tanggal, status: 'Selesai', q: a.id } })).json();
  expect(selesai.data.map((x: Janji) => x.id)).toContain(a.id);
  expect(new Set(selesai.data.map((x: Janji) => x.status))).toEqual(new Set(['Selesai']));
  expect((await pasien.get('/api/klinik/agenda')).status()).toBe(403);
});

test('data pasien dan riwayat kunjungan', async () => {
  const lama = await buatJanji(pasien, nextOpenDay(14), '08:00', 'Batuk berdahak seminggu');
  const baru = await buatJanji(pasien, nextOpenDay(15), '09:30', 'Kontrol batuk berdahak');

  const data = await (await dokter.get(`/api/klinik/appointments/${baru.id}/patient`)).json();
  expect(data.name).toBe('Budi Santoso');
  expect(data.medicalRecordNo).toBe('RM-020419');
  expect(data.visits.map((v: Janji) => v.id)).toEqual([lama.id]); // janji ini sendiri tidak ikut

  expect((await pasien.get(`/api/klinik/appointments/${baru.id}/patient`)).status()).toBe(403);
});

test('daftar janji bisa dicari dan dipaginasi', async () => {
  const jam = ['08:00', '08:30', '09:30', '10:00', '10:30', '13:00'];
  for (const [i, t] of jam.entries()) await buatJanji(pasien, nextOpenDay(16), t, `Keluhan nomor ${i + 1} untuk paginasi`);
  const halaman2 = await (await pasien.get('/api/klinik/appointments', { params: { page: 2, limit: 5 } })).json();
  expect([halaman2.total, halaman2.totalPages, halaman2.data.length]).toEqual([6, 2, 1]);

  const cari = await (await pasien.get('/api/klinik/appointments', { params: { q: 'nomor 3' } })).json();
  expect(cari.data.map((a: Janji) => a.time)).toEqual(['09:30']);
  expect((await pasien.get('/api/klinik/appointments', { params: { status: 'Hilang' } })).status()).toBe(400);
});