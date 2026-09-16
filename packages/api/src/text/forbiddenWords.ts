import { EnglishPluralizer, SpanishPluralizer, type Pluralizer } from './pluralizers.js';
import { WordSet } from './wordSet.js';

export interface TextModeration {
  containsForbidden: boolean;
  hits: number;
  censored: string;
}

/**
 * Fachada del filtro (port de ForbiddenWords.php).
 * No decide politicas: enmascara o informa. Bloquear es de quien llama
 * (ver `decision/decide.ts`, que convierte hits -> decision).
 */
export class ForbiddenWords {
  private pluralizers: Pluralizer[];

  constructor(
    private words: WordSet,
    pluralizers?: Pluralizer[],
  ) {
    this.pluralizers = pluralizers ?? [new SpanishPluralizer(), new EnglishPluralizer()];
  }

  isForbidden(word: string): boolean {
    const lower = word.toLowerCase();
    if (this.words.has(lower)) return true;
    for (const p of this.pluralizers) {
      for (const c of p.singularCandidates(lower)) {
        if (c !== '' && this.words.has(c)) return true;
      }
    }
    return false;
  }

  censor(text: string): string {
    if (text === '' || this.words.count() === 0) return text;
    const censored = text.replace(/\p{L}[\p{L}\p{N}']*/gu, (m) =>
      this.isForbidden(m) ? ForbiddenWords.mask(m) : m,
    );
    return this.censorCjk(censored);
  }

  containsForbidden(text: string): boolean {
    if (text === '') return false;
    return this.censor(text) !== text;
  }

  /** Cuenta palabras prohibidas distintas que aparecen (para `textHits`). */
  countHits(text: string): number {
    if (text === '' || this.words.count() === 0) return 0;
    const tokens = text.match(/\p{L}[\p{L}\p{N}']*/gu) ?? [];
    let hits = 0;
    for (const t of new Set(tokens.map((x) => x.toLowerCase()))) {
      if (this.isForbidden(t)) hits++;
    }
    for (const w of this.words.cjkWords()) {
      if (text.includes(w)) hits++;
    }
    return hits;
  }

  moderate(text: string): TextModeration {
    return { containsForbidden: this.containsForbidden(text), hits: this.countHits(text), censored: this.censor(text) };
  }

  /** Primera mitad visible + `*` (reparto identico al PHP: no cambiar). */
  static mask(word: string): string {
    const chars = [...word];
    if (chars.length <= 1) return '*'.repeat(Math.max(1, chars.length));
    const shown = Math.floor(chars.length / 2);
    return chars.slice(0, shown).join('') + '*'.repeat(chars.length - shown);
  }

  private censorCjk(text: string): string {
    let out = text;
    for (const w of this.words.cjkWords()) {
      if (out.includes(w)) out = out.split(w).join(ForbiddenWords.mask(w));
    }
    return out;
  }
}
