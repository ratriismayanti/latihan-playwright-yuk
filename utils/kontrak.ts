// Contract testing: cocokkan respons asli dengan kontrak OpenAPI yang disajikan server di /spec/<proyek>.json.
// Kontrak menyebut, untuk setiap endpoint dan setiap kode status, bentuk body dan header yang wajib ada.
// Kalau server menambah field yang tidak tercantum, mengganti tipe data, atau mengeluarkan status yang tidak
// terdaftar, test langsung gagal dengan pesan yang menunjuk field-nya.
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { Ajv2020 } from 'ajv/dist/2020.js';

type Operation = { responses: Record<string, { headers?: Record<string, unknown>; content?: Record<string, { schema: object }> }> };
type Spec = { paths: Record<string, Record<string, Operation>>; components: object };

const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false }); // validator JSON Schema, tampilkan semua error sekaligus

export class Kontrak {
  readonly spec: Spec;

  constructor(spec: Spec) {
    this.spec = spec;
  }

  /** path = template di kontrak, misalnya '/api/perpus/loans/{id}'. */
  async cek(method: string, path: string, res: APIResponse) {
    const operation = this.spec.paths[path][method.toLowerCase()];
    const status = String(res.status()); // status respons sebagai teks, misalnya "200"
    const label = `${method.toUpperCase()} ${path} ${status}`; // label untuk pesan error
    expect(Object.keys(operation.responses), `${label}: status ini harus terdaftar di kontrak`).toContain(status); // status harus terdaftar di kontrak
    const response = operation.responses[status]; // aturan respons untuk status itu
    for (const header of Object.keys(response.headers ?? {})) { // setiap header yang wajib harus ada di respons
      expect(res.headers()[header.toLowerCase()], `${label}: header ${header} wajib ada`).toBeTruthy();
    }
    const content = response.content?.['application/json']; // schema body JSON, kalau ada
    if (!content) { // kontrak tidak menyebut body
      expect((await res.body()).length, `${label}: kontrak bilang respons ini tanpa body`).toBe(0);
      return;
    }
    // Skema boleh berisi $ref ke components, jadi components ikut dipasang di akar skema
    const validate = ajv.compile({ ...content.schema, components: this.spec.components });
    const valid = validate(await res.json()); // bandingkan body dengan schema
    expect(valid, `${label} melanggar kontrak: ${ajv.errorsText(validate.errors)}`).toBe(true); // gagal dengan daftar pelanggarannya
  }
}

/** proyek: tokoqa, klinikqa, atau perpusqa. */
export async function muatKontrak(request: APIRequestContext, proyek: string) {
  return new Kontrak(await (await request.get(`/spec/${proyek}.json`)).json());
}