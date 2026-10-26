// Custom fixtures (Modul 10): test cukup "minta" page object atau data awal yang dibutuhkan.
import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { ArenaFormPage } from './pages/ArenaFormPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { KlinikPage } from './pages/KlinikPage';
import { LoginPage } from './pages/LoginPage';
import { ShopPage } from './pages/ShopPage';
import { PerpusAnggotaPage, PerpusMasukPage, PerpusOperatorPage, usernameUnik } from './pages/PerpusPage';
import { loginPerpus } from './utils/perpus-api';

export type PerpusLibrary = {
  library: { id: string; name: string; createdAt: string };
  operator: { id: string; username: string; name: string; role: 'operator' };
  username: string;
  password: string;
};
export type PerpusMember = { id: string; username: string; name: string; status: string; activeLoans: number; totalFine: number; createdAt: string; password: string };
export type DaftarAnggota = (name?: string) => Promise<{ member: PerpusMember; api: APIRequestContext }>;

type Fixtures = { // daftar fixture tambahan beserta tipenya
  loginPage: LoginPage;
  shopPage: ShopPage;
  checkoutPage: CheckoutPage;
  loggedInShop: ShopPage;
  klinikPage: KlinikPage;
  perpusMasuk: PerpusMasukPage;
  perpusAnggota: PerpusAnggotaPage;
  perpusOperator: PerpusOperatorPage;
  perpus: PerpusLibrary;
  operatorApi: APIRequestContext;
  daftarAnggota: DaftarAnggota;
  anggotaApi: APIRequestContext;
  arenaForm: ArenaFormPage;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  shopPage: async ({ page }, use) => {
    await use(new ShopPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  // Login sebagai customer lewat UI pakai kredensial dari .env, lalu berikan ShopPage yang siap dipakai.
  loggedInShop: async ({ loginPage, shopPage }, use) => {
    await loginPage.open();
    await loginPage.login(process.env.TOKOQA_USERNAME!, process.env.TOKOQA_PASSWORD!); // kredensial dari .env
    await expect(shopPage.greeting).toContainText('Halo'); // sudah masuk ke toko
    await use(shopPage);
  },
  klinikPage: async ({ page }, use) => {
    await use(new KlinikPage(page));
  },
  perpusMasuk: async ({ page }, use) => {
    await use(new PerpusMasukPage(page));
  },
  perpusAnggota: async ({ page }, use) => {
    await use(new PerpusAnggotaPage(page));
  },
  perpusOperator: async ({ page }, use) => {
    await use(new PerpusOperatorPage(page));
  },

  // ---------- PerpusQA: satu perpustakaan (sandbox) per test ----------
  // Perpustakaan baru berisi 14 buku contoh, dengan akun pustakawan ber-username acak.
  perpus: async ({ request }, use) => {
    const akun = { username: usernameUnik('pustakawan'), password: 'rahasia123' };
    const res = await request.post('/api/perpus/libraries', { data: { name: 'Perpustakaan Test', operatorName: 'Sari', ...akun } }); // buka perpustakaan baru lewat API
    expect(res.status()).toBe(201); // dibuat (201)
    await use({ ...(await res.json()), ...akun }); // berikan data perpustakaan + akun pustakawan ke test
  },
  // Request context pustakawan yang sudah login (token dikirim di header Authorization).
  operatorApi: async ({ playwright, baseURL, perpus }, use) => {
    const ctx = await loginPerpus(playwright, baseURL, perpus.username, perpus.password);
    await use(ctx);
    await ctx.dispose(); // tutup klien API setelah test
  },
  // Factory: pustakawan mendaftarkan anggota, anggota login, lalu berikan data anggota (+ password) dan request context-nya.
  daftarAnggota: async ({ playwright, baseURL, operatorApi }, use) => {
    const contexts: APIRequestContext[] = [];
    await use(async (name = 'Rina') => {
      const akun = { username: usernameUnik(name.toLowerCase()), password: 'baca123' };
      const member = { ...(await (await operatorApi.post('/api/perpus/members', { data: { name, ...akun } })).json()), password: akun.password }; // pustakawan mendaftarkan anggota
      const api = await loginPerpus(playwright, baseURL, akun.username, akun.password); // anggota login, dapat klien API sendiri
      contexts.push(api); // catat supaya ditutup di akhir
      return { member, api };
    });
    for (const ctx of contexts) await ctx.dispose(); // tutup semua klien API anggota
  },
  // Request context satu anggota bernama Rina yang sudah login.
  anggotaApi: async ({ daftarAnggota }, use) => {
    await use((await daftarAnggota('Rina')).api);
  },

  arenaForm: async ({ page }, use) => {
    await use(new ArenaFormPage(page));
  },
});

export { expect };