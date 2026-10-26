import { test, expect } from '../../fixtures';
import { KlinikPage, nextOpenDay } from '../../pages/KlinikPage';


test('formulir lewat page object', async ({ arenaForm }) => {
  await arenaForm.open();
  await arenaForm.fillForm('Rina', 'Mahir', 'java', false); // isi form dengan satu method
  await arenaForm.submit(); // kirim form
  await expect(arenaForm.result).toContainText('level Mahir | bahasa java'); // level dan bahasa sesuai
  await expect(arenaForm.result).toContainText('newsletter tidak'); // newsletter tidak dicentang
});

test('formulir dengan newsletter', async ({ arenaForm }) => {
  await arenaForm.open();
  await arenaForm.fillForm('Budi', 'Pemula', 'python', true); // data lain, method yang sama
  await arenaForm.submit(); // kirim form
  await expect(arenaForm.result).toContainText('newsletter ya'); // newsletter dicentang
});


test('buat janji temu dengan page object', async ({ page }) => {
  const klinik = new KlinikPage(page);
  await klinik.open(); // buka halaman login klinik
  await klinik.login('pasien', 'sehat123'); // login sebagai pasien
  await expect(klinik.greeting).toHaveText('Halo, Budi Santoso'); // sapaan menyebut nama pasien

  await klinik.book('dr. Sari Lestari', nextOpenDay(2), '10:30', 'Sakit kepala sejak pagi'); // booking tiga langkah dalam satu method
  await expect(klinik.appointmentId).toHaveText(/^KQA-\d+$/); // tunggu nomornya muncul
  await expect(klinik.queueNumber).toHaveText('U-06'); // 10:30 adalah slot ke-6
  const janji = await klinik.appointmentId.innerText(); // simpan nomor janji temu untuk dicek nanti

  await klinik.openMyAppointments(); // buka Janji temu saya
  await expect(klinik.appointment(janji)).toContainText('Terjadwal'); // janji temu baru berstatus Terjadwal
});