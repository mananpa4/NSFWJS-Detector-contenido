/**
 * Inferencia NSFWJS real: el modelo se carga y clasifica de verdad (sin stubs).
 * Se usan imágenes sintéticas (sin pornografía en el repo, como manda el README).
 */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import jpeg from 'jpeg-js';
import {
  backend,
  classifyImageBuffer,
  classifyImageFile,
  frameClassifier,
  MODEL_VERSION,
} from '../src/index.js';

function syntheticJpeg(width = 96, height = 96): Buffer {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 210;
    data[i * 4 + 1] = 185;
    data[i * 4 + 2] = 160;
    data[i * 4 + 3] = 255;
  }
  return jpeg.encode({ data, width, height }, 90).data as unknown as Buffer;
}

function assertScores(scores: Record<string, number>): void {
  const sum =
    (scores.porn ?? 0) +
    (scores.sexy ?? 0) +
    (scores.hentai ?? 0) +
    (scores.neutral ?? 0) +
    (scores.drawing ?? 0);
  for (const [name, value] of Object.entries(scores)) {
    assert.ok(value >= 0 && value <= 1, `${name}=${value} fuera de [0,1]`);
  }
  assert.ok(sum > 0.98 && sum < 1.02, `los scores deben sumar ~1 (sum=${sum})`);
}

describe('NSFWJS real (inferencia, no stub)', () => {
  it('clasifica un buffer JPEG con scores válidos que suman 1', async () => {
    const res = await classifyImageBuffer(syntheticJpeg());
    assert.equal(res.modelVersion, MODEL_VERSION);
    assert.ok(res.latencyMs > 0);
    assertScores(res.scores as unknown as Record<string, number>);
  });

  it('clasifica un archivo en disco y un frame de vídeo', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nsfw-test-'));
    const file = join(dir, 'frame-0001.jpg');
    await writeFile(file, syntheticJpeg());

    const fromFile = await classifyImageFile(file);
    assertScores(fromFile.scores as unknown as Record<string, number>);

    const classifyFrame = frameClassifier();
    const frame = await classifyFrame(file);
    assert.ok(frame.porn >= 0 && frame.porn <= 1);
    assert.ok(frame.sexy >= 0 && frame.sexy <= 1);
  });

  it('reporta el backend usado (wasm o cpu)', async () => {
    await classifyImageBuffer(syntheticJpeg(32, 32));
    assert.ok(['wasm', 'cpu'].includes(backend()), `backend=${backend()}`);
  });
});
