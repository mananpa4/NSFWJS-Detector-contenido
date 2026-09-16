# CLAUDE.md — NSFWJS-Detector-contenido

> **Regla obligatoria:** antes de realizar cualquier cambio importante (nueva feature, refactor, cambio de umbrales, nueva dependencia, cambio de API), Claude **DEBE leer y tener en cuenta `CLAUDE_CONTEXT.md`** completo. `CLAUDE.md` es la referencia permanente; `CLAUDE_CONTEXT.md` es la memoria viva del estado actual. Si ambos entran en conflicto sobre estado/tareas, prevalece `CLAUDE_CONTEXT.md`.

## 1. Qué es este proyecto

Sistema híbrido de **moderación de contenido** (imagen, video y texto) para **detectar material sexual / sugerente / provocativo y restringir o eliminar su publicación**, protegiendo cuentas de **Google AdSense y Meta (Facebook) Audience Network**.

Estrategia central: **merge de funciones relevantes de repos open source y repos hermanos del autor** (no reinventar modelos):

- Clasificación por categorías (NSFWJS, 5 clases) + ViT HF como alternativa.
- Detección/localización con YOLO + segmentación (SafeVision / nsfw_detector_annotator) — TODO inferencia real.
- Rostros como señal complementaria (port de `FaceGuard`: Haar → MediaPipe, degradación elegante).
- OCR (EasyOCR lazy) → **filtro de palabras prohibidas embedded** (port TS de `Forbidden-Words-Multilanguage-System`).
- Frames video con `ffmpeg` del sistema (semántica espejo de `ffmpeg-modulo-multi`).
- VLM local vía Ollama como 2ª opinión **solo en zona gris**.
- Google Cloud Vision + Video Intelligence: referencia funcional, nunca dependencia.

Política de producto: AdSense/Meta penalizan no solo `Porn`, sino también `Sexy/Suggestive`. El sistema es **estricto con lo sugerente**.

## 2. Arquitectura (implementada en scaffold)

```
web-precheck (TF.js + blur pre-subida, opcional)
        │  upload
        ▼
api (@moderacion/api, Express) ──jobs video──▶ worker (@moderacion/worker)
 - decide() pura + umbrales                     - ffmpeg 1fps + batch
 - filtro texto embedded                        - aggregateFrames()
 - store mem|sqlite|pg                          - Ollama (solo pendiente)
 - cola mem|bullmq                              │
 - providers nsfwjs|hf-vit|py-svc               │
        │                                       │
        └─────── faces/ocr ───▶ moderation-svc (FastAPI) ── assets + DB + cola
```

Flujo de decisión (umbrales en `packages/api/src/config/thresholds.ts`):

1. **Imagen:** `classify()` + `faces()` + `ocr()`→filtro texto → `decide()`.
2. **Video:** `probe()` → `extractFrames(1fps)` → batch → `aggregateFrames()` → (si pendiente) VLM sobre peor frame.
3. **Texto:** `ForbiddenWords.moderate()` → `decide({textHits})`.
4. **Estados:** `APROBADO | PENDIENTE_APROBACION | BLOQUEADO` (nunca borrado silencioso).
5. **Acciones:** `aprobar | revisar | difuminar + conservar | bloquear + eliminar`.

## 3. Stack tecnológico

| Capa | Implementado | Notas |
|---|---|---|
| API | Node.js 22+ TypeScript estricto ESM, Express | `packages/api` |
| Decisión | `decide()` pura + `THRESHOLDS` versionados | Testeada (`node --test`), sin I/O |
| Texto | Port TS de Forbidden-Words (WordSet 3 capas, ES/EN pluralizers, mask 1ª mitad) | Reglas 1-3 intactas, ver §7.5 |
| Store | `memory` (Map) · `sqlite` (`node:sqlite` stdlib) · `postgres` (`pg` lazy) | Selección vía `STORE` |
| Cola | `memory` (FIFO) · `bullmq` (Redis, lazy) | Selección vía `QUEUE` |
| Clasificación imagen | `nsfwjs` (lazy) · `hf-vit` (TODO) · `py-svc` (HTTP) | Vía `IMAGE_PROVIDER` |
| Rostros | `python/moderation-svc` (Haar→MediaPipe, degradación elegante) | Port de FaceGuard, sin LBPH/BD |
| OCR | EasyOCR lazy (`engine=none` si falta) | Solo extrae; censura la API |
| Video | `ffmpeg`/`ffprobe` del sistema | Semántica espejo de ffmpeg-modulo-multi |
| VLM 2ª opinión | Ollama (`llava:7b` default), desactivado por defecto | Solo zona gris |
| Pre-check web | `packages/web-precheck` (nsfwjs lazy + blur) | Lo instala la app consumidora |
| Contenedores | `docker/` (api, worker+ffmpeg, py-svc, postgres, redis, ollama perfil `vlm`) | — |

## 4. Estructura de carpetas (real)

```
/
├── CLAUDE.md / CLAUDE_CONTEXT.md / README.md
├── package.json / pnpm-workspace.yaml / tsconfig.base.json / .env.example
├── packages/
│   ├── api/  src/{config,decision,deps,providers,queue,routes,store,text,types}
│   │          data/words.base.txt  test/{decide,forbiddenWords}.test.ts
│   ├── worker/  src/{ffmpeg,videoAggregate,ollama,jobs}  test/video.test.ts
│   └── web-precheck/  src/precheck.ts
├── python/moderation-svc/  app/{main,faces,ocr,schemas}  tests/smoke_no_deps.py
├── scripts/  extract-frames.{sh,ps1}  calibrate-thresholds.py
├── docker/  Dockerfile.{api,worker,py-svc}  docker-compose.yml
├── docs/  arquitectura.md  politicas-adsense-meta.md  umbrales-y-calibracion.md
└── test-assets/  (solo sintéticos o con licencia; NUNCA porn real)
```

Convenciones:

- **Node:** TypeScript estricto, ESM con extensión `.js` en imports, `pnpm`, `node:test` + `node:assert/strict` (sin framework).
- **Python:** 3.10+, `ruff` + `black`, `snake_case`, imports tolerantes a fallos con flags `HAVE_*` (patrón FaceGuard), `logging` no `print`.
- Toda función de moderación expone `{ decision, reasons, thresholdApplied, modelVersion, latencyMs }`.
- Prohibido commitear: assets NSFW reales, pesos `.onnx/.pt/.bin` (descarga en build), credenciales, `.env`, `dist/`, `node_modules/`, `*.db`.
- PowerShell `.ps1` sin tildes (compatibilidad 5.1 sin BOM).

## 5. Política de clasificación y umbrales

Categorías NSFWJS: `Porn | Sexy | Hentai | Neutral | Drawing`. Fuente única: `packages/api/src/config/thresholds.ts` (`THRESHOLDS_VERSION`).

- `porn + sexy >= 0.35` → riesgoso · `porn >= 0.5` o `hentai >= 0.5` → bloqueado.
- `0.20 – 0.35` → `PENDIENTE_APROBACION` · `< 0.20` → `APROBADO`.
- Video: `>10%` frames riesgosos → pendiente; `>30%` o `porn >= 0.8` en un frame → bloqueado.
- Texto: `>= 1` hit → pendiente; `>= 3` hits → bloqueado.
- Calibración: `scripts/calibrate-thresholds.py --csv|--demo`, historial en `docs/umbrales-y-calibracion.md`.

## 6. Comandos importantes

```bash
pnpm install
pnpm --filter @moderacion/api test       # build + 14 tests (decide + texto)
pnpm --filter @moderacion/worker test    # build + 5 tests (agregación + ffmpeg kinds)
pnpm --filter @moderacion/api dev        # API :3000 (STORE=memory por defecto)
pnpm --filter @moderacion/worker dev

python python/moderation-svc/tests/smoke_no_deps.py   # degradación elegante (stdlib)
python scripts/calibrate-thresholds.py --demo
.\scripts\extract-frames.ps1 -VideoPath in.mp4 -Out out\ -Fps 1
./scripts/extract-frames.sh input.mp4 out-dir/ 1

docker compose -f docker/docker-compose.yml up --build
docker compose -f docker/docker-compose.yml --profile vlm up --build  # + ollama
```

## 7. Reglas de trabajo para Claude

1. **Leer `CLAUDE_CONTEXT.md` antes de cambios importantes.** Sin excepción.
2. **Actualizar `CLAUDE_CONTEXT.md`** al completar tareas, decidir umbrales/arquitectura o detectar problemas.
3. No añadir dependencias pesadas (TF, torch, ultralytics, easyocr en Docker) sin justificarlo en `CLAUDE_CONTEXT.md`.
4. Google Vision/Video Intelligence: referencia, nunca path principal.
5. Seguridad/legal: nunca solicitar, generar ni almacenar pornografía real (incl. test). Test solo sintético (`ffmpeg testsrc`) o licenciado. Si el usuario pide procesar datos de menores: **bloquear ese caso de uso**.
6. Todo cambio de lógica de decisión: qué umbral cambió, por qué, y cómo probarlo (test + assets sintéticos).
7. `SKILLS.md`: solo si emergen prompts/skills reutilizables estables. Estado en `CLAUDE_CONTEXT.md`.
8. Fidelidad de ports (no revertir sin leer el repo origen):
   - Texto: palabra completa (no subcadena), singular-derivado (no pluralizar lista), CJK por subcadena larga→corta, `mask()` primera-mitad. Origen: `Forbidden-Words-Multilanguage-System/CLAUDE.md`.
   - Rostros: degradación elegante MediaPipe→Haar→vacío, imports tolerantes. Origen: `FaceGuard/CLAUDE.md`.
   - ffmpeg: `probe()` JSON, `fps=1`, thumbnail 640px, normalize H.264/AAC. Origen: `ffmpeg-modulo-multi/lib/chismy_ffmpeg_multi.dart`.
9. Evitar redundancia `CLAUDE.md` (permanente) vs `CLAUDE_CONTEXT.md` (viva) vs `README.md` (pública).
10. Responder en español.
