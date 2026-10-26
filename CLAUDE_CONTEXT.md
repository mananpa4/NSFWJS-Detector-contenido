# CLAUDE_CONTEXT.md — Memoria viva del proyecto

> Actualizar tras cada tarea importante o decisión técnica. Última actualización: **2026-10-11 (marketplace anti-evasion + OCR trust & safety)**.

## 1. Estado actual

- **Fase:** scaffold híbrido completo + capa marketplace Trust & Safety + **inferencia NSFWJS real** (imagen y vídeo). Monorepo pnpm + FastAPI + Docker.
- **Verde (2026-10-26):** `tsc` limpio en 4 paquetes; api **32/32 tests**; worker **8/8** (5 agregación + 3 pipeline de vídeo real); **nsfw 3/3** (inferencia real); `smoke_no_deps.py` OK; `calibrate --demo` OK; `extract-frames.ps1` e2e OK.
- **Infraestructura decidida por el usuario:** API + worker + Docker; runtime híbrido Node.js+TS + FastAPI; OCR + rostros en MVP; Ollama en MVP (off por defecto); persistencia híbrida (memory+sqlite+postgres, BullMQ opcional).

## 2. Funcionalidades implementadas

- `decide()` pura + umbrales versionados (`THRESHOLDS_VERSION v0.1.0`) + 6 tests + señales marketplace (`marketplaceRisk`, `marketplaceScore`, `marketplaceCategories`, `obfuscationDetected`).
- Filtro texto embedded (port TS fiel: WordSet 3 capas, ES/EN, CJK, mask) + 8 tests + `data/words.base.txt`.
- **`evasion.ts`** — normalizador anti-evasión portado de `Forbidden-Words-Multilanguage-System`: leet, homoglifos cirílicos/griegos, zero-width, separadores intra-palabra, letras espaciadas, variantes fonéticas (guasap→whatsapp). `detectEvasion()` reporta técnicas.
- **`marketplaceDictionary.ts`** — port TS de `MarketplaceDictionary.php`. Carga `data/marketplace-es.json` (C1-C12). `scan()` devuelve LOW/MEDIUM/HIGH, score, flags, categorías, evasión. Regla combinación: contacto + pago externo → HIGH. 9 tests.
- **Rutas `/moderate/text` e `/moderate/image`** — ejecutan `marketplaceFilter.scan()` sobre texto/OCR y alimentan `decide()` con señales marketplace; el resultado incluye objeto `marketplace` con detalle.
- Agregación video + `ffmpeg.ts` + 5 tests.
- `ollama.ts` (solo zona gris, peor frame; `OLLAMA_ENABLED=false` default).
- API Express: `GET /health`, `POST /moderate/{image,text,video}`, `GET /moderate/:id`, `/moderations`.
- Store mem/sqlite/postgres; cola mem/BullMQ; providers nsfwjs/hf-vit/py-svc.
- `moderation-svc`: `/health`, `/detect/faces`, `/ocr` (EasyOCR lazy), `/classify` (TODO onnx).
- `web-precheck`: `precheckImage()` + `blurIntoPlace()`.
- Scripts + Docker + `docs/` (3) + `.env.example`.

## 3. En progreso / pendientes

> **2026-10-26:** el pendiente **#1 (inferencia real NSFWJS) está HECHO** — ver
> `packages/nsfw` (`@moderacion/nsfw`): TensorFlow.js + nsfwjs, JPEG/PNG sin
> nativas, backend WASM con fallback CPU, modelo singleton, `frameClassifier()`
> para vídeo. `NsfwJsClassifier.classify()` clasifica de verdad y
> `moderateVideo()` lo usa por defecto. El **#8 (commit)** también está hecho.

1. [ ] Inferencia real NSFWJS (`NsfwJsClassifier.classify`, hoy neutra) — instalar `nsfwjs` + `@tensorflow/tfjs-node`.
2. [ ] `/classify` ONNX en py-svc + instalar `onnxruntime`.
3. [ ] Suscripción BullMQ real en worker.
4. [ ] YOLO segmentación + blur de regiones (fase 2).
5. [ ] Calibrar con muestra etiquetada real → actualizar `thresholds.ts` + docs.
6. [ ] `words.extra.txt` de producción.
7. [ ] Integrar en shomex.com.mx: usar la API `/moderate/text` en los endpoints de chat del CMS (o portar `marketplaceDictionary.ts` como servicio PHP sidecar).
8. [ ] Commit del scaffold + marketplace (pendiente de orden del usuario).

## 4. Decisiones técnicas

| Fecha | Decisión | Motivo / verificación |
|---|---|---|
| 2026-09-16 | Híbrido Node+TS / FastAPI, stores y colas seleccionables por env | Usuario + vibecoding futuro |
| 2026-09-16 | Texto: port TS (no bridge PHP) | Node no corre PHP; fidelidad con 8 tests espejo |
| 2026-09-16 | Rostros: solo detección (sin LBPH/BD) | Moderación cuenta personas, no identifica |
| 2026-09-16 | OCR solo extrae; censura la API | Separación de responsabilidades |
| 2026-09-16 | Ollama solo en `PENDIENTE`, off por defecto | Costo/latencia |
| 2026-09-16 | Umbrales iniciales estrictos (sexy cuenta) | Política AdSense; `--demo` F1 0.95 en 0.35 |
| **2026-10-11** | **Evasión: normalizar copia, conservar original** | Auditoría + búsqueda de patrones; texto original intacto |
| **2026-10-11** | **Colapsar solo letras sueltas espaciadas, no todos los espacios** | `preg_replace` agresivo fusiona palabras y destruye IDs de pedido |
| **2026-10-11** | **Marketplace: signal vs block por categoría** | WhatsApp sola ≠ infracción; "paga por fuera" = block. Suma de señales decide riesgo |
| **2026-10-11** | **Señales marketplace en `decide()` como campo opcional** | Backward compatible: sin `marketplaceRisk` el comportamiento es idéntico al v0.1.0 |
| **2026-10-11** | **`marketplace-es.json` en `data/` (fuente), no copiado a dist** | El loader usa ruta relativa al src; test usa `../../data` desde dist/test |

| **2026-10-26** | **NSFWJS real en `packages/nsfw` (paquete propio)** | API y worker lo comparten sin duplicar código ni dependencias nativas |
| **2026-10-26** | **Backend WASM con fallback CPU (sin `tfjs-node`)** | `@tensorflow/tfjs-node` necesita libtensorflow nativo; el WASM corre en cualquier Node 20+ y es ~10× más rápido que CPU para lotes de frames |
| **2026-10-26** | **Decodificación JPEG/PNG con `jpeg-js`/`pngjs`** | Sin `sharp` ni nativas: los frames que extrae ffmpeg son JPEG |
| **2026-10-26** | **`moderateVideo` clasifica con NSFWJS por defecto** | El poder de vídeo queda activo sin cablear nada; `neutralFrame` sigue para tests |
| **2026-10-26** | **Extensiones de vídeo ampliadas (34)** | Todas las habituales (`3g2`, `f4v`, `mxf`, `ogm`, `qt`, `y4m`…); ffprobe sigue mandando sobre la extensión |

## 5. Problemas conocidos

- `HfVitClassifier` devuelve neutro (stub tipado); `NsfwJsClassifier` ya clasifica de verdad.
- `py-svc` sin FastAPI instalado localmente: solo `py_compile` + smoke stdlib.
- Sin muestra etiquetada real: umbrales sin validar empíricamente.
- `detectEvasion` heurístico: `LEET` puede dar falsos positivos con precios (`$50`).
- Frases marketplace no cubren todas las variantes dialectales; requiere enumeración o matcher difuso futuro.

## 6. Preguntas abiertas

- Confirmar cuándo hacer commit inicial y si `words.extra.txt` se aporta ahora.
- Definir si shomex.com.mx consume la API por HTTP (sidecar) o portamos `MarketplaceDictionary` a PHP nativo (ya existe en `Forbidden-Words-Multilanguage-System`).

## 7. Integración chismy.com (2026-09-16)

- Paquete `integrations/chismy-nsfw-2026-09-16.zip` (16 archivos, verificado).
- Receta cPanel: NSFWJS en navegador + servidor best-effort + cola `Wo_Chismy_Media_Moderation`.

## 8. SKILLS.md — decisión

- **No crear** (2026-09-16). Reevaluar al estabilizarse.

---
*Historial: 2026-09-16 AM — docs fundacionales. 2026-09-16 PM — decisiones infra + scaffold híbrido. 2026-10-11 — evasion.ts + marketplaceDictionary.ts + señales decide() + rutas moderate + diccionario C1-C12; 32/32 tests.*
