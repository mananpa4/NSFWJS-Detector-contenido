import { aggregateFrames, DEFAULT_VIDEO_THRESHOLDS, type FrameScore } from '../videoAggregate.js';
import { extractFrames, probe } from '../ffmpeg.js';
import { askVlm } from '../ollama.js';

export interface ClassifyFrame {
  (framePath: string): Promise<FrameScore>;
}

/** Clasificador nulo (todo neutro): permite probar el pipeline sin modelos. */
export async function neutralFrame(_framePath: string): Promise<FrameScore> {
  return { porn: 0, sexy: 0 };
}

let nsfwClassify: ClassifyFrame | null = null;

/**
 * Clasificador real de frames (NSFWJS sobre TensorFlow.js, en `@moderacion/nsfw`).
 * El modelo se carga una sola vez y se reutiliza entre frames.
 */
export function nsfwFrameClassifier(): ClassifyFrame {
  return async (framePath: string): Promise<FrameScore> => {
    let classify = nsfwClassify;
    if (classify === null) {
      const { frameClassifier } = await import('@moderacion/nsfw');
      classify = frameClassifier();
      nsfwClassify = classify;
    }
    return classify(framePath);
  };
}

export interface VideoJobResult {
  jobId: string;
  frames: number;
  decision: 'APROBADO' | 'PENDIENTE_APROBACION' | 'BLOQUEADO';
  reasons: string[];
  vlmUsed: boolean;
}

/**
 * Pipeline de video: probe -> frames (1 fps) -> batch clasificador ->
 * agregacion -> (si pendiente) 2a opinion VLM sobre el peor frame.
 *
 * Sin `classify` se usa **NSFWJS real** (`nsfwFrameClassifier()`).
 */
export async function moderateVideo(
  jobId: string,
  videoPath: string,
  classify: ClassifyFrame = nsfwFrameClassifier(),
  fps = 1,
): Promise<VideoJobResult> {
  const info = await probe(videoPath);
  if (info.kind !== 'video' && info.kind !== 'animatedImage') {
    return { jobId, frames: 0, decision: 'APROBADO', reasons: [`kind=${info.kind}, no es video`], vlmUsed: false };
  }
  const frames = await extractFrames(videoPath, undefined, fps);
  const scores: FrameScore[] = [];
  for (const f of frames) scores.push(await classify(f));
  const verdict = aggregateFrames(scores, DEFAULT_VIDEO_THRESHOLDS);

  let vlmUsed = false;
  if (verdict.decision === 'PENDIENTE_APROBACION' && frames.length > 0) {
    // Peor frame = mayor porn+sexy.
    let worst = frames[0] as string;
    let worstScore = -1;
    scores.forEach((s, i) => {
      const v = s.porn + s.sexy;
      if (v > worstScore) {
        worstScore = v;
        worst = frames[i] as string;
      }
    });
    const vlm = await askVlm(worst).catch(() => null);
    if (vlm !== null) {
      vlmUsed = true;
      verdict.reasons.push(`vlm=${vlm.risky ? 'riesgoso' : 'ok'}: ${vlm.description.slice(0, 120)}`);
      if (vlm.risky) verdict.decision = 'BLOQUEADO';
    }
  }
  return { jobId, frames: frames.length, decision: verdict.decision, reasons: verdict.reasons, vlmUsed };
}
