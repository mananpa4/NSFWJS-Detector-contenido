/**
 * Pre-check en navegador con NSFWJS (TensorFlow.js).
 * Rechaza o difumina ANTES de subir: ahorra ancho de banda y protege al revisor.
 * Uso: `import { precheckImage } from '@moderacion/web-precheck'`.
 */

export interface PrecheckResult {
  risky: boolean;
  porn: number;
  sexy: number;
}

interface NsfwPrediction {
  className: 'Porn' | 'Sexy' | 'Hentai' | 'Neutral' | 'Drawing';
  probability: number;
}

interface NsfwModel {
  classify(img: HTMLImageElement): Promise<NsfwPrediction[]>;
}

let model: NsfwModel | null = null;

/** Carga perezosa del modelo (solo navegador). */
export async function loadModel(): Promise<NsfwModel> {
  if (model !== null) return model;
  const nsfwjs = (await import('nsfwjs')) as unknown as {
    load(): Promise<NsfwModel>;
  };
  model = await nsfwjs.load();
  return model;
}

export async function precheckImage(img: HTMLImageElement, riskyAt = 0.35): Promise<PrecheckResult> {
  const m = await loadModel();
  const preds = await m.classify(img);
  const get = (c: NsfwPrediction['className']): number => preds.find((p) => p.className === c)?.probability ?? 0;
  const porn = get('Porn');
  const sexy = get('Sexy');
  return { risky: porn + sexy >= riskyAt, porn, sexy };
}

/** Difumina el elemento en su lugar (conserva layout, tapa contenido). */
export function blurIntoPlace(img: HTMLImageElement, px = 24): void {
  img.style.filter = `blur(${px}px)`;
  img.style.pointerEvents = 'none';
}
