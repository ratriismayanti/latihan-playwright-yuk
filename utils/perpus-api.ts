import { APIRequestContext, request } from '@playwright/test';

/**
 * Melakukan login API dan mengembalikan instance request context baru yang sudah terpasang token Authorization Bearer.
 */
export async function loginPerpus(
  playwright: { request: typeof request },
  baseURL: string | undefined,
  username: string,
  pass: string
): Promise<APIRequestContext> {
  const tempContext = await playwright.request.newContext({ baseURL });
  
  const response = await tempContext.post('/api/perpus/login', {
    data: { username, password: pass },
  });

  if (!response.ok) {
    throw new Error(`Gagal login perpus sebagai ${username}. Status: ${response.status()}`);
  }

  const body = await response.json();
  const token = body.token;

  await tempContext.dispose();

  // Kembalikan context baru yang sudah otomatis menyertakan token JWT
  return await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}