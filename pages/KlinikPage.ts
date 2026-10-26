import type { Locator, Page } from '@playwright/test';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // Date jadi teks YYYY-MM-DD

/** Tanggal (YYYY-MM-DD) beberapa hari ke depan yang bukan hari Minggu, karena klinik tutup hari Minggu. */
export function nextOpenDay(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead); // hari ini + N hari
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // getDay 0 = Minggu, geser ke Senin
  return iso(d);
}

/** Hari Minggu berikutnya, untuk test validasi "klinik tutup". */
export function nextSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1); // mulai dari besok
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1); // maju sampai hari Minggu
  return iso(d);
}

/** Hari Sabtu berikutnya. drg. Maya selalu penuh di hari Sabtu. */
export function nextSaturday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1); // mulai dari besok
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1); // maju sampai hari Sabtu
  return iso(d);
}

/** KlinikQA sisi pasien: login (token di localStorage), booking tiga langkah, dan daftar janji temu. */
export class KlinikPage {
  static readonly LOGIN_URL = '/login-klinik.html';
  static readonly BOOKING_URL = '/klinik.html'; // halaman booking
  static readonly MY_APPOINTMENTS_URL = '/klinik-janji.html'; // halaman Janji temu saya

  readonly page: Page;
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly greeting: Locator;
  readonly toScheduleButton: Locator;
  readonly toConfirmButton: Locator;
  readonly complaint: Locator;
  readonly bookButton: Locator;
  readonly appointmentId: Locator;
  readonly queueNumber: Locator;
  readonly detailLink: Locator;
  readonly appointments: Locator;
  readonly search: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.page = page;
    this.username = page.getByLabel('Username'); // kolom Username
    this.password = page.getByLabel('Password'); // kolom Password
    this.loginButton = page.getByRole('button', { name: 'Masuk' }); // tombol Masuk
    this.greeting = page.getByTestId('greeting'); // sapaan di header
    // Langkah 1 sampai 3 booking
    this.toScheduleButton = page.getByRole('button', { name: 'Lanjut pilih jadwal' });
    this.toConfirmButton = page.getByRole('button', { name: 'Lanjut ke konfirmasi' }); // tombol ke langkah 3
    this.complaint = page.getByLabel('Keluhan'); // kolom keluhan
    this.bookButton = page.getByRole('button', { name: 'Buat janji temu' }); // tombol buat janji temu
    // Halaman berhasil
    this.appointmentId = page.getByTestId('appt-id');
    this.queueNumber = page.getByTestId('queue-number'); // nomor antrean
    this.detailLink = page.getByRole('link', { name: 'Lihat detail janji temu' }); // link ke detail janji temu
    // Daftar janji temu saya
    this.appointments = page.getByTestId('appt-card');
    this.search = page.getByLabel('Cari janji temu'); // kolom pencarian
    this.error = page.getByRole('alert'); // pesan error
  }

  async open() {
    await this.page.goto(KlinikPage.LOGIN_URL);
  }

  async login(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password); // isi Password
    await this.loginButton.click(); // klik Masuk
  }

  day(visitDate: string): Locator {
    // Tombol tanggal di kalender punya atribut data-date (YYYY-MM-DD), jadi test tidak perlu
    // menyusun nama hari dan bulan dalam bahasa Indonesia.
    return this.page.locator(`[data-date="${visitDate}"]`);
  }

  timeSlot(time: string): Locator {
    // exact: true supaya "10:00" tidak ikut cocok dengan label lain yang mengandung teks itu
    return this.page.getByLabel(time, { exact: true });
  }

  async chooseDoctor(doctor: string) {
    await this.page.getByLabel(doctor).check();
    await this.toScheduleButton.click(); // lanjut ke langkah 2
  }

  async chooseSchedule(visitDate: string, time: string) {
    await this.day(visitDate).click();
    await this.timeSlot(time).check(); // pilih jam
    await this.toConfirmButton.click(); // lanjut ke langkah 3
  }

  /** Booking lengkap dari halaman Buat janji temu: dokter, jadwal, lalu konfirmasi. */
  async book(doctor: string, visitDate: string, time: string, complaint: string) {
    await this.chooseDoctor(doctor);
    await this.chooseSchedule(visitDate, time); // langkah 2
    await this.complaint.fill(complaint); // isi keluhan
    await this.bookButton.click(); // buat janji temu
  }

  async openMyAppointments() {
    await this.page.goto(KlinikPage.MY_APPOINTMENTS_URL);
  }

  appointment(appointmentId: string): Locator {
    return this.appointments.filter({ hasText: appointmentId });
  }
}