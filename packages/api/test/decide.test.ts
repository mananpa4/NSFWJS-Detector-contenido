import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../src/decision/decide.js';

describe('decide', () => {
  it('aprueba contenido neutro sin senales', () => {
    const r = decide({ scores: { porn: 0.01, sexy: 0.02, hentai: 0, neutral: 0.95, drawing: 0.02 } }, 't');
    assert.equal(r.decision, 'APROBADO');
    assert.equal(r.suggestedAction, 'aprobar');
  });

  it('bloquea porn alto directo', () => {
    const r = decide({ scores: { porn: 0.9, sexy: 0.05, hentai: 0, neutral: 0.05, drawing: 0 } }, 't');
    assert.equal(r.decision, 'BLOQUEADO');
    assert.equal(r.suggestedAction, 'bloquear');
  });

  it('manda zona gris a pendiente (sexy sugerente)', () => {
    const r = decide({ scores: { porn: 0.1, sexy: 0.25, hentai: 0, neutral: 0.6, drawing: 0.05 } }, 't');
    assert.equal(r.decision, 'PENDIENTE_APROBACION');
  });

  it('bloquea por hits de texto aunque la imagen sea neutra', () => {
    const r = decide(
      { scores: { porn: 0.01, sexy: 0.01, hentai: 0, neutral: 0.97, drawing: 0.01 }, textHits: 3 },
      't',
    );
    assert.equal(r.decision, 'BLOQUEADO');
  });

  it('la 2a opinion VLM eleva a pendiente', () => {
    const r = decide(
      { scores: { porn: 0.05, sexy: 0.05, hentai: 0, neutral: 0.9, drawing: 0 }, vlmRisky: true },
      't',
    );
    assert.equal(r.decision, 'PENDIENTE_APROBACION');
  });

  it('expone contrato versionado', () => {
    const r = decide({}, 'nsfwjs unit');
    assert.match(r.thresholdApplied, /^v\d+\.\d+\.\d+/);
    assert.equal(r.modelVersion, 'nsfwjs unit');
    assert.ok(Array.isArray(r.reasons) && r.reasons.length > 0);
  });
});
