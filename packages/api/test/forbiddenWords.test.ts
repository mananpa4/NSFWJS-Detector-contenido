import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenWords } from '../src/text/forbiddenWords.js';
import { WordSet } from '../src/text/wordSet.js';

function filter(words: string[] = ['casino', 'apuesta']): ForbiddenWords {
  return new ForbiddenWords(new WordSet(words));
}

describe('forbidden-words (port TS)', () => {
  it('detecta el plural aunque la lista declare el singular', () => {
    const f = filter();
    assert.equal(f.isForbidden('CASINOS'), true);
    assert.equal(f.censor('Vamos a los casinos de apuestas'), 'Vamos a los cas**** de apue****');
  });

  it('no destroza palabras legitimas (palabra completa, no subcadena)', () => {
    const f = filter(['as']);
    assert.equal(f.censor('la clase pasa'), 'la clase pasa');
  });

  it('respeta negativos conocidos: casas/flores/dos intactas', () => {
    // Con lista ['casino']: 'flores' -> candidatas 'flor','flore' (ninguna en lista).
    const f = filter(['casino']);
    assert.equal(f.censor('las casas y flores'), 'las casas y flores');
    assert.equal(filter(['do']).censor('los dos'), 'los dos');
  });

  it('el plural valido si se censura: flor -> flores', () => {
    assert.equal(filter(['flor']).censor('las flores'), 'las flo***');
  });

  it('capa removed desactiva sin tocar base', () => {
    const f = new ForbiddenWords(new WordSet(['apuesta'], [], ['apuesta']));
    assert.equal(f.containsForbidden('apuesta'), false);
  });

  it('mask conserva el reparto primera-mitad (pendejo -> pen****)', () => {
    assert.equal(ForbiddenWords.mask('pendejo'), 'pen****');
  });

  it('ingles: boxes/cities/knives', () => {
    const f = filter(['box', 'city', 'knife']);
    assert.equal(f.isForbidden('boxes'), true);
    assert.equal(f.isForbidden('cities'), true);
    assert.equal(f.isForbidden('knives'), true);
  });

  it('CJK por subcadena (excepcion deliberada)', () => {
    const f = filter(['\u8d4c\u535a']); // 賭博
    assert.equal(f.containsForbidden('apuestas \u8d4c\u535a online'), true);
  });
});
