# Arquitectura

Híbrido Node.js + Python, local-first. Google Vision/Video Intelligence
solo como referencia funcional, no como dependencia.

```
                 upload (imagen/video/texto)
                       │
          ┌────────────▼────────────┐
          │  web-precheck (opcional) │  navegador: NSFWJS/TF.js + blur
          └────────────┬────────────┘
                       ▼
          ┌─────────────────────────┐
          │ api (@moderacion/api)   │  Express + decision pura + umbrales
          │ - decide()              │  + filtro texto embedded
          │ - store (mem/sqlite/pg) │  + cola (mem/bullmq)
          │ - providers (nsfwjs/    │
          │   hf-vit/py-svc)        │
          └────┬──────────────┬─────┘
               │ jobs video   │ faces/ocr/classify
               ▼              ▼
   ┌──────────────────┐  ┌────────────────┐
   │ worker           │  │ moderation-svc │  FastAPI (FaceGuard faces,
   │ - ffmpeg 1fps    │  │ - faces (Haar/ │  EasyOCR) + TODO onnx
   │ - batch + agre-  │  │   MediaPipe)   │
   │   gación         │  │ - ocr          │
   │ - Ollama (gris)  │  └────────────────┘
   └──────────────────┘
```

## Puertos (interfaces) y selección por entorno

| Puerto | Implementaciones | Env |
|---|---|---|
| store | memory · sqlite (`node:sqlite`) · postgres (`pg`) | `STORE` |
| queue | memory · bullmq (Redis) | `QUEUE` |
| image provider | nsfwjs · hf-vit (TODO) · py-svc | `IMAGE_PROVIDER` |
| text filter | embedded (port Forbidden-Words) · none | `TEXT_FILTER` |
| py-svc | http · disabled | `PY_SVC_ENABLED` |
| vlm | ollama · null | `OLLAMA_ENABLED` |

Pensado para vibecoding: el agente selecciona la combinación sin
reescribir lógica (la decisión es pura y los providers son adaptadores).

## Origen del código reutilizado (merge, no submódulos)

| Pieza | Origen | Qué se porta |
|---|---|---|
| `packages/api/src/text/*` | `Forbidden-Words-Multilanguage-System` (PHP) | WordSet 3 capas, pluralizers ES/EN, mask primera-mitad. Reglas 1-3 intactas. |
| `python/moderation-svc/app/faces.py` | `FaceGuard` (`faceguard/engine.py`) | Detección Haar→MediaPipe + degradación elegante. Sin LBPH/BD (fase 2). |
| `packages/worker/src/ffmpeg.ts` | `ffmpeg-modulo-multi` (Dart) | Semántica probe/thumbnail/normalize + `fps=1` para moderación. Runtime = ffmpeg del sistema (no bundle). |
| `packages/web-precheck` | `nsfwjs` (InfiniRed) | `precheckImage()` + `blurIntoPlace()`. |

## Flujo de decisión

1. Imagen → `classify()` + `faces()` + `ocr()`→`textFilter` → `decide()`.
2. Video → `probe()` → `extractFrames(1fps)` → batch → `aggregateFrames()`.
3. Zona gris (`PENDIENTE`) → `askVlm()` sobre el peor frame (solo si Ollama activo).
4. Texto → `ForbiddenWords.moderate()` → `decide({textHits})`.

Estados: `APROBADO | PENDIENTE_APROBACION | BLOQUEADO`.
Acciones: `aprobar | revisar | difuminar | bloquear`.
