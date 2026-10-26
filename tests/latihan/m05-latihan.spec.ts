import { test, expect } from '@playwright/test'; // test = pembuat test, expect = pemeriksa hasil


test('klik tiga kali', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const klikAku = page.getByRole('button', { name: 'Klik aku' }); // tombol yang menghitung klik
  for (let i = 0; i < 3; i++) { // ulangi 3 kali
    await klikAku.click(); // klik
  }
  await expect(page.getByTestId('click-count')).toHaveText('3'); // penghitung harus 3
});

test('klik dua kali', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await page.getByRole('button', { name: 'Klik dua kali' }).dblclick(); // klik dua kali cepat
  await expect(page.getByTestId('dbl-result')).toHaveText('Double click terdeteksi!'); // pesan double click muncul
});

test('klik kanan', async ({ page }) => {
    await page.goto('/arena.html'); // buka Arena
    await page.getByRole('button', { name: 'Klik kanan' }).click({ button: 'right' }); // klik kanan
    await expect(page.getByTestId('ctx-result')).toHaveText('Menu Konteks dibuka'); // menu konteks muncul
});

test('isi lalu kosongkan kolom', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const nama = page.getByLabel('Nama lengkap'); // kolom Nama lengkap
  await nama.fill('Rina'); // ketik Rina
  await expect(nama).toHaveValue('Rina'); // isi kolomnya Rina
  await nama.clear(); // kosongkan kolom
  await expect(nama).toHaveValue(''); // kolomnya kosong
  await page.getByLabel('Catatan').fill('Baris pertama\nBaris kedua'); // tanda \n = pindah baris di kolom Catatan
  await expect(page.getByLabel('Catatan')).toHaveValue('Baris pertama\nBaris kedua'); // isinya dua baris
});

test('ketik huruf', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const ketik = page.getByLabel('Ketik di sini'); // kolom latihan keyboard
  await ketik.pressSequentially('halo'); // ketik huruf per huruf
  await expect(ketik).toHaveValue('halo'); // isi kolomnya halo
  await expect(page.getByTestId('last-key')).toHaveText('o'); // huruf terakhir yang ditekan
});


test('radio dan checkbox', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await page.getByLabel('Menengah').check(); // pilih radio Menengah
  await expect(page.getByLabel('Menengah')).toBeChecked(); // harus tercentang

  const newsletter = page.getByLabel('Berlangganan newsletter'); // checkbox newsletter
  await newsletter.check(); // centang
  await expect(newsletter).toBeChecked(); // harus tercentang
  await newsletter.uncheck(); // hilangkan centang
  await expect(newsletter).not.toBeChecked(); // harus tidaktercentang
  await newsletter.setChecked(true); // setChecked cocok kalau nilainya dari data
  await expect(newsletter).toBeChecked(); // harus tercentang
});

test('pilih dropdown', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const bahasa = page.getByLabel('Bahasa favorit'); // dropdown bahasa
  await bahasa.selectOption({ label: 'TypeScript' }); // berdasarkan teks yang terlihat
  await expect(bahasa).toHaveValue('typescript'); // value opsi TypeScript
  await bahasa.selectOption('java');                  // berdasarkan value
  await expect(bahasa).toHaveValue('java'); // opsi Java terpilih
});


test('pilih banyak', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const pilihan = page.getByLabel('Browser yang dites'); // jangan dinamai browser: itu nama fixture Playwright
  await pilihan.selectOption(['Chromium', 'WebKit']); // pilih dua opsi sekaligus
  await expect(pilihan).toHaveValues(['Chromium', 'WebKit']); // kedua opsi terpilih
});

test('isi tanggal', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const tanggal = page.getByLabel('Tanggal mulai'); // kolom tanggal
  await tanggal.fill('2026-11-03'); // input date selalu memakai format YYYY-MM-DD
  await expect(tanggal).toHaveValue('2026-11-03'); // tanggalnya tersimpan
});

test('tombol keyboard', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const ketik = page.getByLabel('Ketik di sini'); // kolom latihan keyboard
  const terakhir = page.getByTestId('last-key'); // tombol terakhir yang ditekan
  await ketik.press('Enter'); // tekan Enter
  await expect(terakhir).toHaveText('Enter'); // tercatat Enter
  await ketik.press('Shift+ArrowLeft'); // kombinasi tombol ditulis dengan +
  await expect(terakhir).toHaveText('Shift+ArrowLeft'); // tercatat kombinasinya
});

test('hover', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await page.getByRole('button', { name: 'Arahkan ke sini' }).hover(); // arahkan kursor tanpa klik
  await expect(page.getByRole('tooltip')).toHaveText('Halo dari tooltip! 👋'); // tooltip muncul

  await page.getByRole('button', { name: 'Menu Produk' }).hover(); // buka menu yang muncul saat hover
  await expect(page.getByRole('link', { name: 'Furnitur' })).toBeVisible(); // isi menu terlihat
});

test('unggah file', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await page.getByLabel('Pilih file').setInputFiles([ // pilih dua file sekaligus, dibuat di memori
    { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('isi a') }, // file pertama: nama, jenis, isi
    { name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('isi b') }, // file kedua
  ]);
  await expect(page.getByTestId('upload-result')).toHaveText('File terpilih: a.txt, b.txt'); // kedua nama file tampil
});

test('seret buah', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  const keranjang = page.getByTestId('basket'); // kotak tujuan seret
  await page.getByText('Jeruk', { exact: true }).dragTo(keranjang); // seret Jeruk ke keranjang
  await page.getByText('Mangga', { exact: true }).dragTo(keranjang); // seret Mangga ke keranjang
  await expect(page.getByTestId('drag-result')).toHaveText('Isi keranjang: Jeruk, Mangga'); // isi keranjang sesuai urutan
});

test('formulir lengkap', async ({ page }) => {
  await page.goto('/arena.html'); // buka Arena
  await page.getByLabel('Nama lengkap').fill('Rina'); // kolom Nama lengkap
  await page.getByLabel('Mahir').check(); // pilih level Mahir
  await page.getByLabel('Bahasa favorit').selectOption({ label: 'Java' }); // dropdown bahasa
  await page.getByLabel('Berlangganan newsletter').uncheck(); // checkbox newsletter
  await page.getByRole('button', { name: 'Kirim formulir' }).click(); // klik
  await expect(page.getByTestId('form-result')).toHaveText( // ringkasan hasil kiriman
    'Terkirim: Rina | level Mahir | bahasa java | browser - | newsletter tidak',
  );
});