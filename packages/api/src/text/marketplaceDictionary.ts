import { detectEvasion, normalizeText } from './evasion.js';

/**
 * Diccionario de comunicacion prohibida para marketplaces (port TS de
 * MarketplaceDictionary.php). Carga dictionaries/marketplace-es.json y
 * clasifica mensajes con nivel de riesgo LOW/MEDIUM/HIGH.
 * No decide politicas finales: el backend aplica la accion.
 */

export interface MarketplaceFlag {
  category: string;
  matchedPattern: string;
  riskAssigned: 'MEDIUM' | 'HIGH';
  evidenceType: 'WORD_MATCH' | 'PHRASE_MATCH' | 'OBFUSCATION';
  recommendedAction: 'REVIEW' | 'BLOCK';
  score: number;
  redacted: boolean;
}

export interface MarketplaceScan {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  action: 'ALLOW' | 'ALLOW_WITH_WARNING' | 'REVIEW' | 'BLOCK';
  score: number;
  matchedCategories: string[];
  flags: MarketplaceFlag[];
  obfuscationDetected: boolean;
  evasionTechniques: string[];
  escalateToHuman: boolean;
  policyVersion: string;
}

interface CategoryDef {
  label: string;
  severity_default: 'signal' | 'block';
  score: number;
  words?: string[];
  phrases?: string[];
}

interface DictFile {
  version: string;
  categories: Record<string, CategoryDef>;
}

export class MarketplaceDictionary {
  private data: DictFile | null = null;

  constructor(private readonly rawJson: string) {}

  static fromJson(json: string): MarketplaceDictionary {
    return new MarketplaceDictionary(json);
  }

  load(): DictFile {
    if (this.data !== null) return this.data;
    const parsed = JSON.parse(this.rawJson) as DictFile;
    if (parsed === null || typeof parsed !== 'object' || parsed.categories === undefined) {
      throw new Error('marketplace dictionary invalida');
    }
    this.data = parsed;
    return parsed;
  }

  scan(message: string): MarketplaceScan {
    const data = this.load();
    const normalized = normalizeText(message);
    const lower = message.toLowerCase();
    const evasion = detectEvasion(message);

    let score = 0;
    const categories: string[] = [];
    const flags: MarketplaceFlag[] = [];
    let blockHit = false;

    for (const [categoryId, cat] of Object.entries(data.categories)) {
      const catScore = cat.score ?? 1;
      const defaultSeverity = cat.severity_default ?? 'signal';
      let matchedInCategory = 0;

      for (const word of cat.words ?? []) {
        const w = word.trim().toLowerCase();
        if (w === '') continue;
        if (this.tokenMatches(normalized, w) || this.tokenMatches(lower, w)) {
          matchedInCategory++;
          const severity = defaultSeverity === 'block' ? 'HIGH' : 'MEDIUM';
          if (defaultSeverity === 'block') blockHit = true;
          flags.push(this.flag(categoryId, w, severity, 'WORD_MATCH', catScore));
        }
      }

      for (const phrase of cat.phrases ?? []) {
        const p = phrase.trim().toLowerCase();
        if (p === '') continue;
        const pNorm = normalizeText(p);
        if (normalized.includes(pNorm) || lower.includes(p)) {
          matchedInCategory++;
          const severity = defaultSeverity === 'block' ? 'HIGH' : 'MEDIUM';
          if (defaultSeverity === 'block') blockHit = true;
          flags.push(this.flag(categoryId, p, severity, 'PHRASE_MATCH', catScore));
        }
      }

      if (matchedInCategory > 0) {
        categories.push(categoryId);
        score += catScore;
      }
    }

    if (evasion.length > 0) {
      score += 2;
      for (const tech of evasion) {
        flags.push(this.flag('EVASION_BYPASS', tech, 'MEDIUM', 'OBFUSCATION', 2));
      }
    }

    const credentialHit = categories.includes('SENSITIVE_DATA');
    const offPlatformPay = categories.includes('OFF_PLATFORM_PAYMENT');
    const contactish =
      categories.includes('EXTERNAL_MESSAGING') || categories.includes('CONTACT_SHARE');
    const externalUrl = categories.includes('EXTERNAL_URL');

    // Regla de combinacion critica: contacto + desvio transaccional -> HIGH.
    if (offPlatformPay && (contactish || externalUrl)) score += 5;
    if (credentialHit) score = Math.max(score, 6);
    if (blockHit) score = Math.max(score, 5);

    const [riskLevel, action] = this.decide(score, blockHit, credentialHit);

    return {
      riskLevel,
      action,
      score,
      matchedCategories: categories,
      flags,
      obfuscationDetected: evasion.length > 0,
      evasionTechniques: evasion,
      escalateToHuman: riskLevel === 'HIGH',
      policyVersion: data.version,
    };
  }

  private tokenMatches(text: string, word: string): boolean {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');
    return re.test(text);
  }

  private decide(
    score: number,
    blockHit: boolean,
    credentialHit: boolean,
  ): ['LOW' | 'MEDIUM' | 'HIGH', 'ALLOW' | 'ALLOW_WITH_WARNING' | 'REVIEW' | 'BLOCK'] {
    if (blockHit || credentialHit || score >= 5) return ['HIGH', 'BLOCK'];
    if (score >= 2) return ['MEDIUM', 'ALLOW_WITH_WARNING'];
    return ['LOW', 'ALLOW'];
  }

  private flag(
    category: string,
    matched: string,
    risk: 'MEDIUM' | 'HIGH',
    evidence: 'WORD_MATCH' | 'PHRASE_MATCH' | 'OBFUSCATION',
    score: number,
  ): MarketplaceFlag {
    return {
      category,
      matchedPattern: matched,
      riskAssigned: risk,
      evidenceType: evidence,
      recommendedAction: risk === 'HIGH' ? 'BLOCK' : 'REVIEW',
      score,
      redacted: false,
    };
  }
}
