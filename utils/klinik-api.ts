import { APIRequestContext, request } from '@playwright/test';

/**
 * Fungsi helper untuk melakukan login ke API KlinikQA dan mengembalikan
 * context request baru yang sudah otomatis menyertakan token JWT di header Authorization.
 * 
 * @param baseURL - URL dasar aplikasi dari konfigurasi Playwright
 * @param username - Nama pengguna (contoh: 'pasien' atau 'dokter')
 * @param password - Kata sandi pengguna
 */
export async function loginKlinik(baseURL: string | undefined, username: string, password: string): Promise<APIRequestContext> {
  // 1. Buat context request sementara khusus untuk melakukan proses login
  const tempRequestContext = await request.newContext({ baseURL });

  // 2. Kirim permintaan POST ke endpoint login klinik
  const response = await tempRequestContext.post('/api/klinik/login', {
    data: { username, password },
  });

  // Pastikan proses login berhasil (status 200 OK)
  if (!response.ok()) {
    throw new Error(`Gagal login sebagai ${username} di KlinikQA. Status: ${response.status()}`);
  }

  const body = await response.json();
  const token = body.token;

  // Tutup context sementara karena kita sudah mendapatkan token-nya
  await tempRequestContext.dispose();

  // 3. Buat dan kembalikan context request baru yang otomatis membawa token di header
  return await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}