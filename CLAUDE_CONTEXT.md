# CLAUDE_CONTEXT.md — Memoria viva del proyecto

> Actualizar tras cada tarea importante o decisión técnica. Última actualización: **2026-09-16 (scaffold híbrido verificado)**.

## 1. Estado actual

- **Fase:** scaffold híbrido completo y verificado. Monorepo pnpm + FastAPI + Docker.
- **Verde (2026-09-16):** `tsc` limpio en 3 paquetes; api 14/14 tests; worker 5/5; `smoke_no_deps.py` OK (engines `none` sin cv2/easyocr); `calibrate --demo` sugiere `risky=0.35` (coincide con default); `extract-frames.ps1` e2e real (video `testsrc` 3s → 3 frames); artefactos de prueba eliminados.
- **Infraestructura decidida por el usuario:** API + worker + Docker; runtime híbrido Node.js+TS + FastAPI; OCR + rostros en MVP; Ollama en MVP (off por defecto); persistencia híbrida (memory+sqlite+postgres, BullMQ opcional) para vibecoding futuro.

## 2. Funcionalidades implementadas

- `decide()` pura + umbrales versionados (`THRESHOLDS_VERSION v0.1.0`) + 6 tests.
- Filtro texto embedded (port TS fiel: WordSet 3 capas, ES/EN, CJK, mask) + 8 tests + `data/words.base.txt`.
- Agregación video (`aggregateFrames`) + `ffmpeg.ts` (probe/frames/thumbnail/normalize) + 5 tests.
- `ollama.ts` (solo zona gris, peor frame; `OLLAMA_ENABLED=false` default).
- API Express: `GET /health`, `POST /moderate/{image,text,video}`, `GET /moderate/:id`, `/moderations`.
- Store mem/sqlite(`node:sqlite`)/postgres(`pg` lazy); cola mem/BullMQ(lazy); providers nsfwjs(lazy)/hf-vit(TODO)/py-svc(HTTP).
- `moderation-svc`: `/health`, `/detect/faces` (Haar→MediaPipe), `/ocr` (EasyOCR lazy), `/classify` (TODO onnx).
- `web-precheck`: `precheckImage()` + `blurIntoPlace()` (nsfwjs lazy).
- Scripts `.sh` + `.ps1` (1fps), `calibrate-thresholds.py` (stdlib, `--demo`), Docker (api/worker/py-svc/postgres/redis/ollama perfil `vlm`), `docs/` (3), `.env.example`.

## 3. En progreso / pendientes

1. [ ] Inferencia real NSFWJS (`NsfwJsClassifier.classify`, hoy neutra) — instalar `nsfwjs` + `@tensorflow/tfjs-node`.
2. [ ] `/classify` ONNX en py-svc (SafeVision/ViT) + instalar `onnxruntime` (+`opencv/mediapipe/easyocr` según perfil).
3. [ ] Suscripción BullMQ real en worker (`Worker('moderate-video')`; hoy `dequeue()` API-side retorna null).
4. [ ] YOLO segmentación + blur de regiones (`nsfw_detector_annotator`, fase 2).
5. [ ] Calibrar con muestra etiquetada real → actualizar `thresholds.ts` + `docs/umbrales-y-calibracion.md`.
6. [ ] `words.extra.txt` de producción + decidir `SKILLS.md` (hoy: no crear).
7. [ ] Commit inicial del scaffold (pendiente de orden del usuario).

## 4. Decisiones técnicas

| Fecha | Decisión | Motivo / verificación |
|---|---|---|
| 2026-09-16 | Híbrido Node+TS / FastAPI, stores y colas seleccionables por env | Usuario + vibecoding futuro; `config/index.ts` |
| 2026-09-16 | Texto: port TS (no bridge PHP) | Node no corre PHP; fidelidad verificada con 8 tests espejo |
| 2026-09-16 | Rostros: solo detección (sin LBPH/BD de FaceGuard) | Moderación necesita contar personas, no identificar |
| 2026-09-16 | OCR solo extrae; censura la API | Separación de responsabilidades |
| 2026-09-16 | Ollama solo en `PENDIENTE`, off por defecto | Costo/latencia |
| 2026-09-16 | `node:sqlite` stdlib para SQLite; `pg`/`bullmq` lazy | Cero nativas en dev; pesadas solo en Docker |
| 2026-09-16 | Tests con `node:test` (sin framework), TS con `.js` en imports | Menos deps, ESM NodeNext |
| 2026-09-16 | Umbrales iniciales estrictos (sexy cuenta) | Política AdSense; `--demo` los respalda (F1 0.95 en 0.35) |
| 2026-09-16 | `.ps1` sin tildes; renombrado `$Input`→`$VideoPath` | `$Input` es variable automática PS; e2e lo demostró |

## 5. Problemas conocidos

- `NsfwJsClassifier` y `HfVitClassifier` devuelven neutro (stubs tipados, no silenciosos: `modelVersion` lo indica).
- `py-svc` sin FastAPI instalado localmente: solo verificado `py_compile` + smoke stdlib (FastAPI real en Docker).
- `pnpm-lock.yaml` generado; `node_modules/` + `dist/` gitignorados pero presentes en disco.
- Sin muestra etiquetada real: umbrales sin validar empíricamente.

## 6. Preguntas abiertas

- Ninguna bloqueante. Confirmar cuándo hacer commit inicial y si `words.extra.txt` se aporta ahora.

## 7. Integración chismy.com (2026-09-16) — paquete `integrations/chismy-nsfw-2026-09-16.zip`

- **Diagnóstico:** SafeSearch nativo (`detect_safe_search`, Vision API) activo pero ciego (`adult_images=1`, sin clave válida → deja pasar todo). Filtro de texto ya robusto (plurales ES/EN, mask 1ª mitad, 6452 palabras); Node-chat solo exact-match (sin plurales).
- **Receta cPanel (sin TF/Py en servidor):** NSFWJS en navegador (pre-check + veredicto) + servidor best-effort (bloquea texto ≥3 hits, 100% confiable) + cola `Wo_Chismy_Media_Moderation` + `active=0` nativo para dudosos + admin en página existente.
- **Zip verificado:** 16 archivos (3 nuevos + 12 modificados + SQL en raíz), 0 backslashes, `unzip -t` OK, cmp 16/16. Staging en `integrations/chismy-nsfw/` (chismy.com intacto).
- **Mejoras texto:** CJK por subcadena + tilde ES (`aviones`→`avión`) + `Wo_ProfanityCountHits()` en PHP y paridad Node.
- **Pendiente usuario:** importar SQL, subir zip, probar. Fase 2: VPS NSFWJS-Detector + `nsfw_api_url`.

## 7. SKILLS.md — decisión

- **No crear** (2026-09-16). Reevaluar al estabilizarse: prompt VLM 2ª opinión, receta calibración, receta blur por segmentación.

---
*Historial: 2026-09-16 AM — docs fundacionales (repo vacío). 2026-09-16 PM — decisiones infra + scaffold híbrido verificado (tests + e2e).*
