/**
 * Pipeline de vídeo con inferencia NSFWJS **real** (frames → batch → agregación).
 * Se genera un vídeo sintético con ffmpeg (nunca contenido real en el repo).
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';
import { moderateVideo, neutralFrame, nsfwFrameClassifier } from '../src/jobs/moderateVideo.js';

const run = promisify(execFile);

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await run('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

async function syntheticVideo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'video-test-'));
  const video = join(dir, 'clip.mp4');
  await run('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=160x120:rate=10',
    '-pix_fmt', 'yuv420p', video,
  ]);
  return video;
}

describe('moderateVideo (pipeline real)', () => {
  it('extrae frames y clasifica con NSFWJS', async (t) => {
    if (!(await ffmpegAvailable())) {
      t.skip('ffmpeg no disponible');
      return;
    }
    const video = await syntheticVideo();
    const res = await moderateVideo('job-real', video, nsfwFrameClassifier(), 1);
    assert.ok(res.frames > 0, `debe extraer frames (frames=${res.frames})`);
    assert.ok(
      ['APROBADO', 'PENDIENTE_APROBACION', 'BLOQUEADO'].includes(res.decision),
      `decisión inesperada: ${res.decision}`,
    );
    assert.ok(res.reasons.length > 0);
    assert.equal(res.vlmUsed, false);
  });

  it('el clasificador neutro sigue funcionando (pruebas sin modelo)', async (t) => {
    if (!(await ffmpegAvailable())) {
      t.skip('ffmpeg no disponible');
      return;
    }
    const video = await syntheticVideo();
    const res = await moderateVideo('job-neutro', video, neutralFrame, 1);
    assert.equal(res.decision, 'APROBADO', 'sin señales → aprobado');
  });

  it('rechaza archivos que no son vídeo', async (t) => {
    if (!(await ffmpegAvailable())) {
      t.skip('ffmpeg no disponible');
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), 'not-video-'));
    const file = join(dir, 'foto.jpg');
    await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=1:size=64x64', '-frames:v', '1', file]);
    const res = await moderateVideo('job-imagen', file, neutralFrame, 1);
    assert.equal(res.frames, 0);
    assert.equal(res.decision, 'APROBADO');
  });
});
