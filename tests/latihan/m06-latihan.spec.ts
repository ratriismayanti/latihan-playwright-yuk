import { test, expect } from '@playwright/test'; // test = pembuat test, expect = pemeriksa hasil


test('notifikasi', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await page.getByRole('button', { name: 'Simpan' }).click(); // munculkan toast
  const notifikasi = page.getByText('Data tersimpan'); // toast sementara
  await expect(notifikasi).toBeVisible(); // notifikasi muncul
  await expect(notifikasi).toBeHidden({ timeout: 5000 }); // hilang sendiri setelah 3 detik
});

test('teks persis, sebagian, dan pola', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await page.getByRole('button', { name: 'Klik dua kali' }).dblclick(); // klik dua kali
  const hasil = page.getByTestId('dbl-result'); // teks hasil double click
  await expect(hasil).toHaveText('Double click terdeteksi!'); // persis
  await expect(hasil).toContainText('terdeteksi');           // sebagian
  await expect(hasil).toHaveText(/^Double click/);           // pola
});

test('urutkan nilai', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await page.getByRole('button', { name: 'Urutkan nilai tertinggi' }).click(); // urutkan tabel
  await expect(page.locator('#students tr td:first-child')).toHaveText(['Citra', 'Dewi', 'Andi', 'Eko', 'Budi']); // kolom nama, urut dari nilai tertinggi
});

test('nilai kolom dan kolom kosong', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const nama = page.getByLabel('Nama lengkap'); // kolom Nama lengkap
  await expect(nama).toBeEmpty(); // awalnya kosong
  await nama.fill('Rina'); // ketik Rina
  await expect(nama).toHaveValue('Rina'); // isinya Rina
});

test('status centang', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const newsletter = page.getByLabel('Berlangganan newsletter'); // checkbox newsletter
  await expect(newsletter).not.toBeChecked(); // awalnya belum dicentang
  await newsletter.check(); // centang
  await expect(newsletter).toBeChecked(); // sekarang tercentang
});

test('tombol proses', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const proses = page.getByRole('button', { name: 'Proses' }); // tombol yang aktif belakangan
  await expect(proses).toBeDisabled(); // baru dibuka: belum bisa diklik
  await expect(proses).toBeEnabled();  // auto-waiting sampai aktif (sekitar 2 detik)
  await proses.click(); // klik setelah aktif
  await expect(page.getByTestId('late-result')).toHaveText('Diproses!'); // hasil setelah tombol diproses
});

test('jumlah elemen', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await expect(page.locator('#students tr')).toHaveCount(5); // 5 baris siswa

  await page.getByRole('button', { name: 'Muat data' }).click(); // data dimuat 1,5 detik kemudian
  await expect(page.getByTestId('loaded-list').getByRole('listitem')).toHaveCount(3); // ada 3 butir data
});


test('atribut link unduhan', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const unduh = page.getByRole('link', { name: 'Unduh laporan' }); // link unduhan
  await expect(unduh).toHaveAttribute('href', '/download/laporan.csv'); // link menunjuk file CSV
  await expect(unduh).toHaveAttribute('download', ''); // atribut ada, tanpa nilai
});

test('URL dan judul halaman', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await expect(page).toHaveURL(/\/arena\.html$/); // URL berakhiran /arena.html
  await expect(page).toHaveTitle('Arena Latihan - Playground'); // judul tab persis ini
});

test('kebalikan dengan not', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await expect(page.getByRole('tooltip')).not.toBeVisible(); // tooltip belum muncul sebelum hover
  await expect(page.getByTestId('click-count')).not.toHaveText('1'); // setelah klik kedua, bukan 1 lagi
  await page.getByRole('button', { name: 'Klik aku' }).click(); // klik sekali
  await expect(page.getByTestId('click-count')).toHaveText('1'); // penghitung jadi 1
});

test('batas waktu khusus', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await page.getByRole('button', { name: 'Mulai unduh' }).click(); // mulai progress bar
  // Unduhan butuh sekitar 2 detik. Batas waktu dinaikkan hanya untuk pengecekan ini.
  await expect(page.getByTestId('prog-text')).toHaveText('Selesai', { timeout: 8000 }); // progress bisa sampai 5 detik, batas tunggu dinaikkan
});


// Modul 6 — Assertion & auto-waiting.

const LOGIN = '/login-toko.html'; // halaman login TokoQA
const ARENA = '/arena.html'; // halaman latihan interaksi

test('berbagai assertion', async ({ page }) => {
  await page.goto(LOGIN); // buka halaman login TokoQA
  await expect(page).toHaveURL(/login-toko\.html$/); // URL berakhiran login-toko.html
  await expect(page).toHaveTitle(/TokoQA/); // judul tab mengandung TokoQA

  const username = page.getByLabel('Username'); // kolom Username
  await expect(username).toBeEmpty(); // masih kosong
  await expect(username).toHaveAttribute('placeholder', 'contoh: customer'); // teks contoh di dalam kolom
  await username.fill('customer'); // isi Username
  await expect(username).toHaveValue('customer'); // isinya customer

  await expect(page.getByRole('alert')).toBeHidden(); // belum ada pesan error
  await expect(page.getByRole('button', { name: 'Masuk' })).toContainText('Mas'); // cukup mengandung sebagian teks
});

test('auto-wait konten dinamis', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  await page.getByRole('button', { name: 'Muat data' }).click(); // data dimuat 1,5 detik kemudian
  // Data baru muncul setelah 1,5 detik. Tidak perlu sleep — expect menunggu sendiri.
  await expect(page.getByText('Data berhasil dimuat')).toBeVisible(); // expect menunggu sampai teks ini muncul
  await expect(page.getByTestId('loaded-list').getByRole('listitem')).toHaveCount(3); // ada 3 butir data
});

test('tombol yang aktif belakangan', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  const tombol = page.getByRole('button', { name: 'Proses' }); // tombol yang aktif setelah ±2 detik
  await expect(tombol).toBeDisabled(); // awalnya belum bisa diklik
  await expect(tombol).toBeEnabled(); // menunggu sampai ±2 detik
  await tombol.click(); // klik setelah aktif
  await expect(page.getByTestId('late-result')).toHaveText('Diproses!'); // hasilnya muncul
});

test('negasi dan timeout khusus', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  await page.getByRole('button', { name: 'Simpan' }).click(); // munculkan toast
  const toast = page.getByText('Data tersimpan'); // notifikasi sementara
  await expect(toast).toBeVisible(); // toast terlihat
  await expect(toast).not.toBeVisible({ timeout: 6000 }); // toast hilang setelah 3 detik
});

test('soft assertion: lanjut walau ada yang gagal', async ({ page }) => {
  await page.goto(LOGIN); // buka halaman login TokoQA
  // expect.soft mencatat kegagalan tapi test tetap jalan sampai akhir
  await expect.soft(page).toHaveTitle('Login — TokoQA'); // dicatat kalau gagal, test tetap lanjut
  await expect.soft(page.getByLabel('Username')).toBeVisible(); // kolom Username terlihat
  await expect.soft(page.getByLabel('Password')).toBeVisible(); // kolom Password terlihat
});

test('progress sampai selesai', async ({ page }) => {
  await page.goto(ARENA); // buka Arena
  await page.getByRole('button', { name: 'Mulai unduh' }).click(); // mulai progress bar
  await expect(page.getByTestId('prog-text')).toHaveText('Selesai'); // tunggu sampai tulisannya Selesai
  await expect(page.getByLabel('Progress unduhan')).toHaveAttribute('value', '100'); // nilai progress bar 100
});