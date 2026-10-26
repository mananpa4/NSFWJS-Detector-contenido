import type { NsfwScores } from '../types.js';

/** Clasificador de imagen: NSFWJS directo, ViT HF o delegacion al py-svc. */
export interface ImageClassifier {
  name: string;
  classify(imagePath: string): Promise<{ scores: NsfwScores; latencyMs: number }>;
}

/**
 * NSFWJS **real** (`@moderacion/nsfw`: TensorFlow.js + pesos del paquete).
 * Imports lazy para no cargar el modelo si `IMAGE_PROVIDER` es otro.
 */
export class NsfwJsClassifier implements ImageClassifier {
  name = 'nsfwjs';
  async classify(imagePath: string): Promise<{ scores: NsfwScores; latencyMs: number }> {
    const { classifyImageFile } = await import('@moderacion/nsfw');
    const { scores, latencyMs } = await classifyImageFile(imagePath);
    return { scores, latencyMs };
  }
}

/** ViT Hugging Face (`Falconsai/nsfw_image_detection`). TODO: inferencia real. */
export class HfVitClassifier implements ImageClassifier {
  name = 'hf-vit';
  async classify(_imagePath: string): Promise<{ scores: NsfwScores; latencyMs: number }> {
    const empty: NsfwScores = { porn: 0, sexy: 0, hentai: 0, neutral: 1, drawing: 0 };
    return { scores: empty, latencyMs: 0 };
  }
}

/** Delega al microservicio Python (clasificacion pesada / ONNX / YOLO). */
export class PySvcClassifier implements ImageClassifier {
  name = 'py-svc';
  constructor(private baseUrl: string) {}
  async classify(imagePath: string): Promise<{ scores: NsfwScores; latencyMs: number }> {
    const started = Date.now();
    const res = await fetch(`${this.baseUrl}/classify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image_path: imagePath }),
    });
    if (!res.ok) throw new Error(`py-svc classify fallo: ${res.status}`);
    const data = (await res.json()) as { scores: NsfwScores };
    return { scores: data.scores, latencyMs: Date.now() - started };
  }
}
