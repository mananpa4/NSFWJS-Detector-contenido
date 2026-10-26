/**
 * Normalizacion anti-evasion (port de EvasionNormalizer.php).
 * Reconstruye la forma canonica de tokens/texos evadidos con leet,
 * homoglifos, separadores, letras espaciadas y variantes foneticas.
 * El texto original se conserva para auditoria; esto es representacion auxiliar.
 */

const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/gu;

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

const HOMOGLYPHS: Record<string, string> = {
  '\u0430': 'a', // cyrillic a
  '\u0435': 'e', // cyrillic ie
  '\u043E': 'o', // cyrillic o
  '\u0440': 'p', // cyrillic er
  '\u0441': 'c', // cyrillic es
  '\u0443': 'y', // cyrillic u
  '\u0445': 'x', // cyrillic ha
  '\u0456': 'i', // cyrillic i
  '\u04BB': 'h', // cyrillic shha
  '\u03B1': 'a', // greek alpha
  '\u03B5': 'e', // greek epsilon
  '\u03BF': 'o', // greek omicron
  '\u03C1': 'p', // greek rho
  '\u03C3': 's', // greek sigma
  '\u03C5': 'u', // greek upsilon
  '\u03C7': 'x', // greek chi
};

const PHONETIC: Record<string, string> = {
  guasap: 'whatsapp',
  wazap: 'whatsapp',
  wasap: 'whatsapp',
  watsap: 'whatsapp',
  wsp: 'whatsapp',
  wpp: 'whatsapp',
  tb: 'telegram',
  tgram: 'telegram',
  tg: 'telegram',
  igm: 'instagram',
  insta: 'instagram',
};

function replaceMap(text: string, map: Record<string, string>): string {
  let out = text;
  for (const [from, to] of Object.entries(map)) out = out.split(from).join(to);
  return out;
}

export function normalizeToken(token: string): string {
  let t = token.replace(INVISIBLE, '').toLowerCase();
  t = replaceMap(t, HOMOGLYPHS);
  t = replaceMap(t, LEET);
  // Separadores intra-palabra: w.h.a.t.s -> whats
  t = t.replace(/(?<=\p{L})[._\-*\u00B7\u2022](?=\p{L})/gu, '');
  return PHONETIC[t] ?? t;
}

export function normalizeText(text: string): string {
  let t = text.replace(INVISIBLE, '').toLowerCase();
  t = replaceMap(t, HOMOGLYPHS);
  t = replaceMap(t, LEET);
  // Colapsa SOLO secuencias de letras sueltas separadas por espacios:
  // "p a g a   p o r   f u e r a" -> "paga por fuera".
  t = t.replace(/(?<![\p{L}\p{N}])(?:\p{L} )+\p{L}(?![\p{L}\p{N}])/gu, (m) => m.replace(/ /g, ''));
  t = t.replace(/\s{2,}/gu, ' ');
  return t.trim();
}

/** Tecnicas de evasion observadas en el texto original (para EVASION_BYPASS). */
export function detectEvasion(text: string): string[] {
  const found: string[] = [];
  if (/[\u00AD\u200B-\u200D\u2060\uFEFF]/u.test(text)) found.push('ZERO_WIDTH');
  if (/\p{L}[._\-*\u00B7\u2022]\p{L}/u.test(text)) found.push('SEPARATORS');
  if (/\b\w\s\w\s\w\s\w\b/u.test(text)) found.push('SPACED_LETTERS');
  if (/\p{L}[0-9@$]|[0-9@$]\p{L}/u.test(text)) found.push('LEET');
  if (/[\u0400-\u04FF\u0370-\u03FF]/u.test(text)) found.push('HOMOGLYPHS');
  return found;
}
