import type { Locator, Page } from '@playwright/test';

/** Formulir di Arena (kotak 2). Jawaban latihan Modul 10. */
export class ArenaFormPage {
  static readonly URL = '/arena.html';

  readonly page: Page;
  readonly fullName: Locator;
  readonly language: Locator;
  readonly newsletter: Locator;
  readonly submitButton: Locator;
  readonly result: Locator;

  constructor(page: Page) {
    this.page = page;
    this.fullName = page.getByLabel('Nama lengkap'); // kolom Nama lengkap
    this.language = page.getByLabel('Bahasa favorit'); // dropdown bahasa
    this.newsletter = page.getByLabel('Berlangganan newsletter'); // checkbox newsletter
    this.submitButton = page.getByRole('button', { name: 'Kirim formulir' }); // tombol kirim
    this.result = page.getByTestId('form-result'); // ringkasan hasil kiriman
  }

  async open() {
    await this.page.goto(ArenaFormPage.URL);
  }

  async fillForm(name: string, level: string, language: string, newsletter: boolean) {
    await this.fullName.fill(name);
    await this.page.getByLabel(level).check(); // pilih radio level (label = nama level)
    await this.language.selectOption(language); // pilih bahasa
    await this.newsletter.setChecked(newsletter); // centang atau lepas sesuai nilai true/false
  }

  async submit() {
    await this.submitButton.click();
  }
}