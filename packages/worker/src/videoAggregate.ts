/** Agregacion de scores por frame -> veredicto de video (funcion pura). */

export interface FrameScore {
  porn: number;
  sexy: number;
}

export interface VideoVerdict {
  frames: number;
  riskyFrames: number;
  ratioRisky: number;
  maxPorn: number;
  maxRisky: number;
  decision: 'APROBADO' | 'PENDIENTE_APROBACION' | 'BLOQUEADO';
  reasons: string[];
}

export interface VideoThresholds {
  risky: number;
  reviewRatio: number;
  blockRatio: number;
  blockSinglePorn: number;
}

/** Umbrales por defecto = los de packages/api (duplicados aqui para worker standalone). */
export const DEFAULT_VIDEO_THRESHOLDS: VideoThresholds = {
  risky: 0.35,
  reviewRatio: 0.1,
  blockRatio: 0.3,
  blockSinglePorn: 0.8,
};

export function aggregateFrames(frames: FrameScore[], t: VideoThresholds = DEFAULT_VIDEO_THRESHOLDS): VideoVerdict {
  const reasons: string[] = [];
  if (frames.length === 0) {
    return { frames: 0, riskyFrames: 0, ratioRisky: 0, maxPorn: 0, maxRisky: 0, decision: 'APROBADO', reasons: ['sin frames'] };
  }
  let riskyFrames = 0;
  let maxPorn = 0;
  let maxRisky = 0;
  for (const f of frames) {
    const risky = f.porn + f.sexy;
    maxPorn = Math.max(maxPorn, f.porn);
    maxRisky = Math.max(maxRisky, risky);
    if (risky >= t.risky) riskyFrames++;
  }
  const ratioRisky = riskyFrames / frames.length;

  let decision: VideoVerdict['decision'] = 'APROBADO';
  if (maxPorn >= t.blockSinglePorn) {
    decision = 'BLOQUEADO';
    reasons.push(`frame con porn=${maxPorn.toFixed(3)} >= ${t.blockSinglePorn}`);
  } else if (ratioRisky >= t.blockRatio) {
    decision = 'BLOQUEADO';
    reasons.push(`ratio=${ratioRisky.toFixed(3)} >= block(${t.blockRatio})`);
  } else if (ratioRisky >= t.reviewRatio) {
    decision = 'PENDIENTE_APROBACION';
    reasons.push(`ratio=${ratioRisky.toFixed(3)} >= review(${t.reviewRatio})`);
  }
  if (reasons.length === 0) reasons.push(`maxRisky=${maxRisky.toFixed(3)} bajo umbral`);
  return { frames: frames.length, riskyFrames, ratioRisky, maxPorn, maxRisky, decision, reasons };
}
