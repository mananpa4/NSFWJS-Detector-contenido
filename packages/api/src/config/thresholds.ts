/**
 * Umbrales de decision versionados.
 *
 * REGLA: estos valores viven aqui y solo aqui. La logica de `decision/`
 * los consume, nunca los hardcodea. Cada cambio se registra en
 * CLAUDE_CONTEXT.md (decision tecnica) y se calibra con
 * `scripts/calibrate-thresholds.py` (ver docs/umbrales-y-calibracion.md).
 *
 * Politica: estricta con lo sugerente (AdSense/Meta penalizan Sexy,
 * no solo Porn).
 */
export const THRESHOLDS_VERSION = 'v0.1.0-2026-09-16';

export interface ThresholdSet {
  /** porn + sexy >= risky -> RIESGOSO (bloqueo o pendiente segun severidad). */
  risky: number;
  /** porn >= blockPorn -> BLOQUEADO directo. */
  blockPorn: number;
  /** hentai >= blockHentai -> BLOQUEADO directo. */
  blockHentai: number;
  /** reviewMin..risky -> PENDIENTE_APROBACION (zona gris). */
  reviewMin: number;
  /** Video: ratio de frames riesgosos -> pendiente. */
  videoReviewRatio: number;
  /** Video: ratio de frames riesgosos -> bloqueado. */
  videoBlockRatio: number;
  /** Video: cualquier frame con porn >= esto -> bloqueado. */
  videoBlockSinglePorn: number;
  /** Texto: n. de hits de palabras prohibidas -> pendiente. */
  textReviewHits: number;
  /** Texto: n. de hits -> bloqueado. */
  textBlockHits: number;
}

function num(env: string | undefined, fallback: number): number {
  const v = env === undefined ? NaN : Number(env);
  return Number.isFinite(v) ? v : fallback;
}

export const THRESHOLDS: ThresholdSet = {
  risky: num(process.env.TH_RISKY, 0.35),
  blockPorn: num(process.env.TH_BLOCK_PORN, 0.5),
  blockHentai: num(process.env.TH_BLOCK_HENTAI, 0.5),
  reviewMin: num(process.env.TH_REVIEW_MIN, 0.2),
  videoReviewRatio: num(process.env.TH_VIDEO_REVIEW_RATIO, 0.1),
  videoBlockRatio: num(process.env.TH_VIDEO_BLOCK_RATIO, 0.3),
  videoBlockSinglePorn: num(process.env.TH_VIDEO_BLOCK_SINGLE_PORN, 0.8),
  textReviewHits: num(process.env.TH_TEXT_REVIEW_HITS, 1),
  textBlockHits: num(process.env.TH_TEXT_BLOCK_HITS, 3),
};
