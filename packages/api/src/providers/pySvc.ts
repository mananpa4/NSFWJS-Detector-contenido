/** Cliente HTTP del microservicio Python (rostros <- FaceGuard, OCR <- EasyOCR). */

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PySvc {
  faces(imagePath: string): Promise<{ count: number; boxes: FaceBox[]; latencyMs: number }>;
  ocr(imagePath: string): Promise<{ text: string; latencyMs: number }>;
}

export class HttpPySvc implements PySvc {
  constructor(private baseUrl: string) {}

  async faces(imagePath: string): Promise<{ count: number; boxes: FaceBox[]; latencyMs: number }> {
    const started = Date.now();
    const res = await fetch(`${this.baseUrl}/detect/faces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image_path: imagePath }),
    });
    if (!res.ok) throw new Error(`py-svc faces fallo: ${res.status}`);
    const data = (await res.json()) as { count: number; boxes: FaceBox[] };
    return { ...data, latencyMs: Date.now() - started };
  }

  async ocr(imagePath: string): Promise<{ text: string; latencyMs: number }> {
    const started = Date.now();
    const res = await fetch(`${this.baseUrl}/ocr`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image_path: imagePath }),
    });
    if (!res.ok) throw new Error(`py-svc ocr fallo: ${res.status}`);
    const data = (await res.json()) as { text: string };
    return { ...data, latencyMs: Date.now() - started };
  }
}

/** Nulo cuando PY_SVC_ENABLED=false: cuenta 0 rostros y texto vacio. */
export class DisabledPySvc implements PySvc {
  async faces(): Promise<{ count: number; boxes: FaceBox[]; latencyMs: number }> {
    return { count: 0, boxes: [], latencyMs: 0 };
  }
  async ocr(): Promise<{ text: string; latencyMs: number }> {
    return { text: '', latencyMs: 0 };
  }
}
