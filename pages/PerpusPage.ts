import { Page, Locator } from '@playwright/test';

/**
 * Menghasilkan tanggal dalam format string YYYY-MM-DD berdasarkan jumlah hari yang lalu.
 */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Menghasilkan username unik dengan string acak agar aman untuk tes paralel.
 */
export function usernameUnik(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Halaman Login untuk PerpusQA
 */
export class PerpusMasukPage {
  readonly page: Page;
  readonly userInput: Locator;
  readonly passInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userInput = page.locator('input[name="username"]');
    this.passInput = page.locator('input[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
  }

  async login(username: string, pass: string) {
    await this.page.goto('/perpus/login.html');
    await this.userInput.fill(username);
    await this.passInput.fill(pass);
    await this.submitButton.click();
  }
}

/**
 * Halaman Operator / Pustakawan untuk PerpusQA
 */
export class PerpusOperatorPage {
  readonly page: Page;
  readonly statLate: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statLate = page.locator('[data-testid="stat-late"]');
  }

  loanRow(loanId: number | string): Locator {
    return this.page.locator(`tr[data-loan-id="${loanId}"]`);
  }

  async receive(loanId: number | string) {
    const row = this.loanRow(loanId);
    await row.locator('button.btn-receive, button:text("Terima")').click();
    const modalConfirm = this.page.locator('.modal button.btn-confirm, .modal button:text("Ya")');
    if (await modalConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modalConfirm.click();
    }
  }
}

/**
 * Halaman Sisi Anggota untuk PerpusQA
 */
export class PerpusAnggotaPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async bukaKatalog() {
    await this.page.goto('/perpus/catalog.html');
  }
}