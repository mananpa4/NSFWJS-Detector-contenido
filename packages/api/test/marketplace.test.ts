import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectEvasion, normalizeText, normalizeToken } from '../src/text/evasion.js';
import { MarketplaceDictionary } from '../src/text/marketplaceDictionary.js';

const here = dirname(fileURLToPath(import.meta.url));
// dist/test/ -> ../../data (fuente, no compilado)
const dictJson = readFileSync(join(here, '..', '..', 'data', 'marketplace-es.json'), 'utf8');
const market = MarketplaceDictionary.fromJson(dictJson);

describe('evasion normalizer', () => {
  it('leet c4s1n0 -> casino', () => {
    assert.equal(normalizeToken('c4s1n0'), 'casino');
  });

  it('separadores w.h.a.t.s -> whats', () => {
    assert.equal(normalizeToken('w.h.a.t.s'), 'whats');
  });

  it('homoglifo cirillico', () => {
    assert.equal(normalizeToken('c\u0430sino'), 'casino');
  });

  it('zero-width eliminado', () => {
    assert.equal(normalizeToken('cas\u200Bino'), 'casino');
  });

  it('fonetica guasap -> whatsapp', () => {
    assert.equal(normalizeToken('guasap'), 'whatsapp');
  });

  it('texto letras espaciadas -> frase', () => {
    assert.equal(normalizeText('p a g a   p o r   f u e r a'), 'paga por fuera');
  });

  it('detectEvasion: zero width', () => {
    assert.deepEqual(detectEvasion('hola\u200Bmundo'), ['ZERO_WIDTH']);
  });

  it('detectEvasion: separadores', () => {
    assert.deepEqual(detectEvasion('w.h.a.t.s'), ['SEPARATORS']);
  });

  it('detectEvasion: texto limpio no detecta', () => {
    assert.deepEqual(detectEvasion('hola mundo'), []);
  });
});

describe('marketplace dictionary', () => {
  it('pago por fuera -> HIGH/BLOCK', () => {
    const r = market.scan('Cancela el pedido y te pago por fuera con transferencia directa');
    assert.equal(r.riskLevel, 'HIGH');
    assert.equal(r.action, 'BLOCK');
    assert.ok(r.matchedCategories.includes('OFF_PLATFORM_PAYMENT'));
  });

  it('whatsapp sola no block', () => {
    const r = market.scan('Tienes WhatsApp para dudas?');
    assert.notEqual(r.action, 'BLOCK');
    assert.notEqual(r.riskLevel, 'HIGH');
  });

  it('combinacion contacto + pago -> HIGH', () => {
    const r = market.scan('Escribeme al whatsapp y te pago por fuera');
    assert.equal(r.riskLevel, 'HIGH');
  });

  it('insulto signal en OFFENSES', () => {
    const r = market.scan('Eres un pendejo');
    assert.ok(r.matchedCategories.includes('OFFENSES'));
  });

  it('letras espaciadas evadidas -> block', () => {
    const r = market.scan('P a g a   p o r   f u e r a y te lo mando');
    assert.equal(r.riskLevel, 'HIGH');
    assert.equal(r.obfuscationDetected, true);
  });

  it('mensaje limpio ALLOW score 0', () => {
    const r = market.scan('Hola, cuando llega mi pedido #12345?');
    assert.equal(r.action, 'ALLOW');
    assert.equal(r.score, 0);
  });

  it('OTP -> HIGH por SENSITIVE_DATA', () => {
    const r = market.scan('Envia el codigo OTP que te llego por SMS');
    assert.equal(r.riskLevel, 'HIGH');
  });

  it('disputa manipulation block', () => {
    const r = market.scan('No abras el reclamo y te devuelvo el dinero');
    assert.equal(r.riskLevel, 'HIGH');
  });

  it('phishing block', () => {
    const r = market.scan('Tu cuenta sera suspendida si no verificas tu cuenta en este enlace');
    assert.equal(r.riskLevel, 'HIGH');
  });
});
