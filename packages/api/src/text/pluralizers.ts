/**
 * Port TypeScript de `Forbidden-Words-Multilanguage-System` (PHP, MIT).
 * Origen: ../.. (repo hermano del mismo autor).
 *
 * Se conservan las 3 decisiones que no se revierten sin leer el CLAUDE.md
 * de aquel repo:
 *  1. Coincidencia por palabra completa (token Unicode), no subcadena.
 *  2. Se deriva el singular del token, no se pluraliza la lista.
 *  3. CJK (Han/Hiragana/Katakana/Hangul) va por subcadena, de mas larga a mas corta.
 * Enmascarado identico: primera mitad visible + `*` (`pendejo` -> `pen****`).
 */

/** Interfaz Pluralizer: deriva posibles singulares de una palabra. */
export interface Pluralizer {
  language(): string;
  singularCandidates(word: string): string[];
}

const MIN_LENGTH = 4;

/** Plurales del espanol: casinos->casino, papeles->papel, luces->luz. */
export class SpanishPluralizer implements Pluralizer {
  language(): string {
    return 'es';
  }
  singularCandidates(word: string): string[] {
    const chars = [...word];
    if (chars.length < MIN_LENGTH || !word.endsWith('s')) return [];
    const out = new Set<string>();
    if (word.endsWith('ces')) out.add(chars.slice(0, -3).join('') + 'z');
    if (word.endsWith('es')) {
      const stem = chars.slice(0, -2).join('');
      out.add(stem);
      const accented = accentLastVowel(stem);
      if (accented !== null) out.add(accented);
    }
    out.add(chars.slice(0, -1).join(''));
    return [...out].filter((c) => c !== '');
  }
}

/** Plurales del ingles: cats->cat, boxes->box, cities->city, knives->knife/knif. */
export class EnglishPluralizer implements Pluralizer {
  language(): string {
    return 'en';
  }
  singularCandidates(word: string): string[] {
    const chars = [...word];
    if (chars.length < MIN_LENGTH || !word.endsWith('s')) return [];
    const out = new Set<string>();
    if (word.endsWith('ies')) out.add(chars.slice(0, -3).join('') + 'y');
    if (word.endsWith('ves')) {
      const stem = chars.slice(0, -3).join('');
      out.add(stem + 'fe');
      out.add(stem + 'f');
    }
    if (word.endsWith('es')) out.add(chars.slice(0, -2).join(''));
    out.add(chars.slice(0, -1).join(''));
    return [...out].filter((c) => c !== '');
  }
}

const ACCENTS: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

function accentLastVowel(stem: string): string | null {
  const chars = [...stem];
  for (let i = chars.length - 1; i >= 0; i--) {
    const acc = ACCENTS[chars[i] ?? ''];
    if (acc !== undefined) return chars.slice(0, i).join('') + acc + chars.slice(i + 1).join('');
  }
  return null;
}
