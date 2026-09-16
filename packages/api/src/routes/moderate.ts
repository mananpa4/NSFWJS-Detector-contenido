import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { decide } from '../decision/decide.js';
import type { Deps } from '../deps.js';
import type { ModerationRecord } from '../types.js';

export function moderateRouter(deps: Deps): Router {
  const r = Router();

  r.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'api-moderacion' });
  });

  /** Modera una imagen ya almacenada en disco (path local o montado). */
  r.post('/moderate/image', async (req, res) => {
    try {
      const imagePath = String(req.body?.imagePath ?? '');
      if (imagePath === '') {
        res.status(400).json({ error: 'imagePath requerido' });
        return;
      }
      const started = Date.now();
      const { scores, latencyMs: clfMs } = await deps.imageClassifier.classify(imagePath);
      const faces = await deps.pySvc.faces(imagePath).catch(() => ({ count: 0, boxes: [], latencyMs: 0 }));
      let ocrText = '';
      try {
        ocrText = (await deps.pySvc.ocr(imagePath)).text;
      } catch {
        ocrText = '';
      }
      const textHits = deps.textFilter === null || ocrText === '' ? 0 : deps.textFilter.countHits(ocrText);

      const result = decide(
        { scores, faceCount: faces.count, textHits },
        `${deps.imageClassifier.name}+faces+ocr`,
      );
      const record: ModerationRecord = {
        ...result,
        id: randomUUID(),
        kind: 'image',
        createdAt: new Date().toISOString(),
        latencyMs: Date.now() - started + clfMs * 0,
      };
      await deps.store.save(record);
      res.json(record);
    } catch (err) {
      res.status(502).json({ error: `fallo moderacion imagen: ${(err as Error).message}` });
    }
  });

  /** Modera texto (caption, comentario, OCR ya extraido). */
  r.post('/moderate/text', async (req, res) => {
    const text = String(req.body?.text ?? '');
    const textHits = deps.textFilter === null ? 0 : deps.textFilter.countHits(text);
    const censored = deps.textFilter === null ? text : deps.textFilter.censor(text);
    const result = decide({ textHits }, 'forbidden-words-embedded');
    const record: ModerationRecord = {
      ...result,
      id: randomUUID(),
      kind: 'text',
      createdAt: new Date().toISOString(),
    };
    await deps.store.save(record);
    res.json({ ...record, censored });
  });

  /** Encola un video para el worker (extraccion de frames + batch). */
  r.post('/moderate/video', async (req, res) => {
    const videoPath = String(req.body?.videoPath ?? '');
    if (videoPath === '') {
      res.status(400).json({ error: 'videoPath requerido' });
      return;
    }
    const job = {
      id: randomUUID(),
      videoPath,
      fps: Number(req.body?.fps ?? 1),
      createdAt: new Date().toISOString(),
    };
    await deps.queue.enqueue(job);
    res.status(202).json({ jobId: job.id, status: 'encolado' });
  });

  r.get('/moderate/:id', async (req, res) => {
    const record = await deps.store.get(req.params.id ?? '');
    if (record === null) {
      res.status(404).json({ error: 'no encontrado' });
      return;
    }
    res.json(record);
  });

  r.get('/moderations', async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    res.json(await deps.store.list(Number.isFinite(limit) ? limit : 50));
  });

  return r;
}
