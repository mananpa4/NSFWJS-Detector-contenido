import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateFrames } from '../src/videoAggregate.js';
import { kindFromPath } from '../src/ffmpeg.js';

describe('aggregateFrames', () => {
  it('aprueba video limpio', () => {
    const v = aggregateFrames(Array.from({ length: 10 }, () => ({ porn: 0.01, sexy: 0.02 })));
    assert.equal(v.decision, 'APROBADO');
    assert.equal(v.frames, 10);
  });

  it('bloquea si un frame supera porn unico', () => {
    const frames = Array.from({ length: 10 }, () => ({ porn: 0.01, sexy: 0.01 }));
    frames[3] = { porn: 0.9, sexy: 0.05 };
    assert.equal(aggregateFrames(frames).decision, 'BLOQUEADO');
  });

  it('pendiente con >10% frames riesgosos', () => {
    const frames = Array.from({ length: 10 }, () => ({ porn: 0.01, sexy: 0.01 }));
    frames[0] = { porn: 0.2, sexy: 0.2 };
    frames[1] = { porn: 0.25, sexy: 0.2 };
    assert.equal(aggregateFrames(frames).decision, 'PENDIENTE_APROBACION');
  });

  it('bloquea con >30% frames riesgosos', () => {
    const frames = Array.from({ length: 10 }, () => ({ porn: 0.3, sexy: 0.2 }));
    assert.equal(aggregateFrames(frames).decision, 'BLOQUEADO');
  });
});

describe('kindFromPath (espejo ffmpeg-modulo-multi)', () => {
  it('clasifica por extension', () => {
    assert.equal(kindFromPath('clip.mp4'), 'video');
    assert.equal(kindFromPath('anim.gif'), 'animatedImage');
    assert.equal(kindFromPath('foto.webp'), 'image');
    assert.equal(kindFromPath('audio.ogg'), 'audio');
    assert.equal(kindFromPath('raro.xyz'), 'unknown');
  });
});
