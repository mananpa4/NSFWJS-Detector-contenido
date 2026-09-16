/** Lista efectiva en 3 capas: base + extra - removed (port de WordSet.php). */
export class WordSet {
  private set: Map<string, boolean> | null = null;
  private cjk: string[] | null = null;

  constructor(
    private base: string[] = [],
    private extra: string[] = [],
    private removed: string[] = [],
  ) {}

  all(): Map<string, boolean> {
    if (this.set !== null) return this.set;
    const removed = new Set<string>();
    for (const w of this.removed) {
      const lower = w.trim().toLowerCase();
      if (lower !== '') removed.add(lower);
    }
    const set = new Map<string, boolean>();
    for (const w of [...this.base, ...this.extra]) {
      const lower = w.trim().toLowerCase();
      if (lower === '' || removed.has(lower)) continue;
      set.set(lower, true);
    }
    this.set = set;
    return set;
  }

  has(lowerWord: string): boolean {
    return this.all().has(lowerWord);
  }

  count(): number {
    return this.all().size;
  }

  /** Palabras CJK puras, de mas larga a mas corta. */
  cjkWords(): string[] {
    if (this.cjk !== null) return this.cjk;
    const words = [...this.all().keys()].filter((w) =>
      /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+$/u.test(w),
    );
    words.sort((a, b) => [...b].length - [...a].length);
    this.cjk = words;
    return words;
  }

  /** Divide texto de admin (comas y/o saltos de linea). */
  static parse(text: string): string[] {
    return [...new Set(text.split(/[,\r\n]+/u).map((w) => w.trim()).filter((w) => w !== ''))];
  }
}
