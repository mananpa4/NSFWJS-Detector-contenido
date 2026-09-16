import { THRESHOLDS, THRESHOLDS_VERSION } from '../config/thresholds.js';
import type { ModerationResult, ModerationSignals, SuggestedAction } from '../types.js';

/**
 * Funcion pura de decision: senales -> resultado versionado.
 * Sin I/O, sin dependencias: testeable con `node --test`.
 */
export function decide(signals: ModerationSignals, modelVersion: string): ModerationResult {
  const started = Date.now();
  const t = THRESHOLDS;
  const reasons: string[] = [];
  let risky = false;
  let blocked = false;

  const s = signals.scores;
  if (s !== undefined) {
    const sum = s.porn + s.sexy;
    if (s.porn >= t.blockPorn) {
      blocked = true;
      reasons.push(`porn=${s.porn.toFixed(3)} >= block(${t.blockPorn})`);
    }
    if (s.hentai >= t.blockHentai) {
      blocked = true;
      reasons.push(`hentai=${s.hentai.toFixed(3)} >= block(${t.blockHentai})`);
    }
    if (sum >= t.risky) {
      risky = true;
      reasons.push(`porn+sexy=${sum.toFixed(3)} >= risky(${t.risky})`);
    } else if (sum >= t.reviewMin) {
      risky = true;
      reasons.push(`porn+sexy=${sum.toFixed(3)} en zona gris [${t.reviewMin}, ${t.risky})`);
    }
  }

  const faces = signals.faceCount ?? 0;
  if (faces > 0) reasons.push(`rostros=${faces}`);

  const hits = signals.textHits ?? 0;
  if (hits >= t.textBlockHits) {
    blocked = true;
    reasons.push(`palabras-prohibidas=${hits} >= block(${t.textBlockHits})`);
  } else if (hits >= t.textReviewHits) {
    risky = true;
    reasons.push(`palabras-prohibidas=${hits} >= review(${t.textReviewHits})`);
  }

  if (signals.vlmRisky === true) {
    risky = true;
    reasons.push('vlm-2a-opinion=riesgoso');
  }

  let action: SuggestedAction = 'aprobar';
  let decision: ModerationResult['decision'] = 'APROBADO';
  if (blocked) {
    decision = 'BLOQUEADO';
    action = 'bloquear';
  } else if (risky) {
    // Alta severidad visual (porn alto aunque < block) -> sugerir blur+conservar.
    const severe = (s?.porn ?? 0) >= t.risky || (s?.hentai ?? 0) >= t.reviewMin;
    decision = 'PENDIENTE_APROBACION';
    action = severe ? 'difuminar' : 'revisar';
  }

  if (reasons.length === 0) reasons.push('sin senales de riesgo');

  return {
    decision,
    suggestedAction: action,
    reasons,
    thresholdApplied: THRESHOLDS_VERSION,
    modelVersion,
    latencyMs: Date.now() - started,
    ...(s === undefined ? {} : { scores: s }),
  };
}
