/** Tipos compartidos del dominio de moderacion. */

/** Estados de moderacion. Nunca se borra en silencio: la zona gris es pendiente. */
export type Decision = 'APROBADO' | 'PENDIENTE_APROBACION' | 'BLOQUEADO';

/** Acciones sugeridas al integrador. */
export type SuggestedAction = 'aprobar' | 'revisar' | 'difuminar' | 'bloquear';

/** Scores NSFWJS (5 clases). */
export interface NsfwScores {
  porn: number;
  sexy: number;
  hentai: number;
  neutral: number;
  drawing: number;
}

/** Senales que alimentan la decision (cada una puede venir de un proveedor). */
export interface ModerationSignals {
  /** Scores del clasificador de imagen (NSFWJS / ViT / py-svc). */
  scores?: NsfwScores;
  /** N. de rostros detectados (py-svc <- FaceGuard). */
  faceCount?: number;
  /** N. de palabras prohibidas halladas en OCR/caption (filtro embedded). */
  textHits?: number;
  /** La 2a opinion VLM marco el contenido como riesgoso. */
  vlmRisky?: boolean;
}

/** Resultado versionado de moderacion (contrato de toda funcion de decision). */
export interface ModerationResult {
  decision: Decision;
  suggestedAction: SuggestedAction;
  reasons: string[];
  thresholdApplied: string;
  modelVersion: string;
  latencyMs: number;
  scores?: NsfwScores;
}

/** Trabajo de video en cola. */
export interface VideoJob {
  id: string;
  videoPath: string;
  fps?: number;
  createdAt: string;
}

/** Registro persistido de una moderacion. */
export interface ModerationRecord extends ModerationResult {
  id: string;
  kind: 'image' | 'video' | 'text';
  createdAt: string;
}
