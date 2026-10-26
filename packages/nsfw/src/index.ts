/**
 * Inferencia NSFWJS **real** (TensorFlow.js) para imagen y frames de vídeo.
 *
 * Sustituye al stub `NsfwJsClassifier` (pendiente #1 de CLAUDE_CONTEXT.md):
 * carga el modelo una sola vez, decodifica JPEG/PNG sin dependencias nativas
 * (`jpeg-js`, `pngjs`) y devuelve los 5 scores de NSFWJS.
 *
 * Backend: se intenta **WASM** (mucho más rápido para lotes de frames) y se
 * degrada a **CPU** puro si el runtime WASM no está disponible. Sin GPU:
 * el trabajo de vídeo corre en el worker, no en un navegador.
 */
import { readFile } from 'node:fs/promises';

export interface NsfwScores {
  porn: number;
  sexy: number;
  hentai: number;
  neutral: number;
  drawing: number;
}

export interface ClassifyResult {
  scores: NsfwScores;
  latencyMs: number;
  modelVersion: string;
}

interface Prediction {
  className: string;
  probability: number;
}

interface NsfwModel {
  classify(input: unknown): Promise<Prediction[]>;
  dispose?: () => Promise<void>;
}

export const MODEL_VERSION = 'nsfwjs@4.4.0';

let tfPromise: Promise<typeof import('@tensorflow/tfjs')> | null = null;
let modelPromise: Promise<NsfwModel> | null = null;
let backendName = 'cpu';

/** Backend realmente usado (`wasm` o `cpu`). */
export function backend(): string {
  return backendName;
}

async function loadTf(): Promise<typeof import('@tensorflow/tfjs')> {
  if (tfPromise !== null) return tfPromise;
  tfPromise = (async () => {
    const tf = await import('@tensorflow/tfjs');
    try {
      await import('@tensorflow/tfjs-backend-wasm');
      if (await tf.setBackend('wasm')) backendName = 'wasm';
    } catch {
      backendName = 'cpu';
    }
    if (tf.getBackend() !== 'wasm') {
      await tf.setBackend('cpu');
      backendName = 'cpu';
    }
    await tf.ready();
    return tf;
  })();
  return tfPromise;
}

/** Carga el modelo (singleton). Los pesos viajan dentro del paquete `nsfwjs`. */
export async function loadModel(): Promise<NsfwModel> {
  if (modelPromise !== null) return modelPromise;
  modelPromise = (async () => {
    await loadTf();
    const nsfwjs = await import('nsfwjs');
    return (await nsfwjs.load()) as unknown as NsfwModel;
  })();
  return modelPromise;
}

export async function disposeModel(): Promise<void> {
  const pending = modelPromise;
  modelPromise = null;
  try {
    const model = await pending;
    await model?.dispose?.();
  } catch {
    /* modelo no llego a cargar */
  }
}

/* ----------------------------- decodificación ---------------------------- */

export interface DecodedImage {
  data: Uint8Array; // RGBA
  width: number;
  height: number;
}

/** Decodifica JPEG o PNG a RGBA (sin librerías nativas). */
export async function decodeImage(input: Buffer | Uint8Array): Promise<DecodedImage> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (isPng) {
    const { PNG } = await import('pngjs');
    const png = PNG.sync.read(buf);
    return { data: new Uint8Array(png.data), width: png.width, height: png.height };
  }
  const jpeg = await import('jpeg-js');
  const decoded = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { data: decoded.data, width: decoded.width, height: decoded.height };
}

async function toTensor(image: DecodedImage): Promise<{ dispose(): void }> {
  const tf = await loadTf();
  const { width, height, data } = image;
  const rgb = new Int32Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4) {
    rgb[j++] = data[i] as number;
    rgb[j++] = data[i + 1] as number;
    rgb[j++] = data[i + 2] as number;
  }
  return tf.tensor3d(rgb, [height, width, 3], 'int32');
}

function toScores(preds: Prediction[]): NsfwScores {
  const get = (name: string): number =>
    preds.find((p) => p.className.toLowerCase() === name.toLowerCase())?.probability ?? 0;
  return {
    porn: get('Porn'),
    sexy: get('Sexy'),
    hentai: get('Hentai'),
    neutral: get('Neutral'),
    drawing: get('Drawing'),
  };
}

/* ------------------------------- inferencia ------------------------------ */

/** Clasifica un buffer de imagen (JPEG/PNG) ya en memoria. */
export async function classifyImageBuffer(input: Buffer | Uint8Array): Promise<ClassifyResult> {
  const started = Date.now();
  const model = await loadModel();
  const image = await decodeImage(input);
  const tensor = await toTensor(image);
  try {
    const preds = await model.classify(tensor as unknown);
    return { scores: toScores(preds), latencyMs: Date.now() - started, modelVersion: MODEL_VERSION };
  } finally {
    tensor.dispose();
  }
}

/** Clasifica un archivo de imagen en disco. */
export async function classifyImageFile(imagePath: string): Promise<ClassifyResult> {
  const started = Date.now();
  const buf = await readFile(imagePath);
  const result = await classifyImageBuffer(buf);
  return { ...result, latencyMs: Date.now() - started };
}

/**
 * Clasificador de frames para el pipeline de vídeo: recibe la ruta de un frame
 * (JPEG extraído por ffmpeg) y devuelve sólo `porn`/`sexy`, que es lo que
 * consume `aggregateFrames()`.
 */
export function frameClassifier(): (framePath: string) => Promise<{ porn: number; sexy: number }> {
  return async (framePath: string) => {
    const { scores } = await classifyImageFile(framePath);
    return { porn: scores.porn, sexy: scores.sexy };
  };
}
