# NSFWJS-Detector-contenido

Sistema híbrido de **moderación de imagen, video y texto** para detectar contenido sexual, sugerente o provocativo y **restringir o eliminar su publicación**, protegiendo cuentas de **Google AdSense y Meta Audience Network**.

> **Merge, no reinvención:** NSFWJS + ports de [`FaceGuard`](https://github.com/mananpa4/FaceGuard) (rostros), filtro de palabras (port TS de `Forbidden-Words-Multilanguage-System`), semántica ffmpeg de `ffmpeg-modulo-multi` y Ollama como 2ª opinión. Todo local; Google Vision/Video Intelligence solo como referencia.

## Cómo funciona

| Canal | Pipeline |
|---|---|
| **Imagen** | `classify()` (nsfwjs/ViT/py-svc) + rostros + OCR→filtro texto → `decide()` |
| **Video** | `ffmpeg` 1 fps → batch → agregación (max + ratio) → VLM solo si pendiente |
| **Texto** | Filtro embedded (singular-derivado ES/EN, CJK) → `decide({textHits})` |
| **Decisión** | `APROBADO` · `PENDIENTE_APROBACION` · `BLOQUEADO` → `aprobar/revisar/difuminar/bloquear` |

Umbrales estrictos con lo sugerente (`porn+sexy ≥ 0.35` riesgoso; zona gris `0.20–0.35` a revisión). Fuente única versionada: `packages/api/src/config/thresholds.ts`.

## Estructura

```
packages/api ──► packages/worker ──► python/moderation-svc (FastAPI :8001)
(Express :3000)   (ffmpeg + Ollama)    (rostros FaceGuard + EasyOCR)
packages/web-precheck (TF.js + blur) · scripts/ · docker/ · docs/
```

Puertos seleccionables por entorno (pensado para vibecoding): `STORE=memory|sqlite|postgres`, `QUEUE=memory|bullmq`, `IMAGE_PROVIDER=nsfwjs|hf-vit|py-svc`, `TEXT_FILTER`, `OLLAMA_ENABLED`. Ver `.env.example`.

## Quickstart

```bash
pnpm install
pnpm --filter @moderacion/api test      # 14 tests en verde
pnpm --filter @moderacion/worker test   # 5 tests en verde
pnpm --filter @moderacion/api dev       # API en :3000
python python/moderation-svc/tests/smoke_no_deps.py
python scripts/calibrate-thresholds.py --demo
.\scripts\extract-frames.ps1 -VideoPath in.mp4 -Out out\ -Fps 1
docker compose -f docker/docker-compose.yml up --build
```

## Estado

✅ **Scaffold híbrido verificado** (2026-09-16): decisión + texto + agregación con tests en verde, py-svc con degradación elegante, ffmpeg e2e real (3s→3 frames), Docker listo. Pendiente: inferencia real NSFWJS/ONNX/YOLO, suscripción BullMQ del worker, calibración con datos reales. Detalle en [`CLAUDE_CONTEXT.md`](./CLAUDE_CONTEXT.md), diseño en [`CLAUDE.md`](./CLAUDE.md) y [`docs/`](./docs).

## Seguridad y legal

- Sin pornografía real en el repo (ni para test): solo sintéticos o con licencia.
- No procesar datos de menores. Sin credenciales ni `.env` commiteados.
