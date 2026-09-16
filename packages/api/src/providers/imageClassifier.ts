import type { NsfwScores } from '../types.js';

/** Clasificador de imagen: NSFWJS directo, ViT HF o delegacion al py-svc. */
export interface ImageClassifier {
  name: string;
  classify(imagePath: string): Promise<{ scores: NsfwScores; latencyMs: number }>;
}

function emptyScores(): NsfwScores {
  return { porn: 0, sexy: 0, hentai: 0, neutral: 1, drawing: 0 };
}

/**
 * NSFWJS (`nsfwjs` + `@tensorflow/tfjs-node`). Imports lazy para no
 * obligar a la dependencia nativa si IMAGE_PROVIDER es otro.
 * TODO(vibecoding): cablear load() + inferencia real sobre el buffer.
 */
export class NsfwJsClassifier implements ImageClassifier {
  name = 'nsfwjs';
  async classify(_imagePath: string): Promise<{ scores: NsfwScores; latencyMs: number }> {
    const started = Date.now();
    await import('nsfwjs').catch(() => null);
    // Sin modelo cargado aun: senal neutra + latencia real del intento.
    return { scores: emptyScores(), latencyMs: Date.now() - started };
  }
}

/** ViT Hugging Face (`Falconsai/nsfw_image_detection`). TODO: inferencia real. */
export class HfVitClassifier implements ImageClassifier {
  name = 'hf-vit';
  async classify(_imagePath: string): Promise<{ scores: NsfwScores; latencyMs: number }> {
    return { scores: emptyScores(), latencyMs: 0 };
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
