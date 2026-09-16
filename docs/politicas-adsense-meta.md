# Políticas AdSense y Meta (resumen operativo)

> No es asesoría legal. Verifica siempre las políticas oficiales vigentes:
> Google AdSense "Contenido apto" y Meta "Normas de monetización".

## Idea central

Ambas plataformas exigen inventario "apto para todo público" para
publicidad estándar. Penalización = limitación de anuncios o inhabilitación.
No solo importa la desnudez explícita: **lo sugerente también infringe**.

## Qué mapea a nuestras categorías

| Categoría NSFWJS | Riesgo AdSense/Meta | Tratamiento |
|---|---|---|
| `Porn` | Infracción directa | `BLOQUEADO` (auto, alta confianza) |
| `Hentai` | Infracción directa | `BLOQUEADO` (auto, alta confianza) |
| `Sexy` (lencería, baño explícito, poses) | "Al límite" / sugerente: limita o inhabilita | `PENDIENTE`→revisión o `BLOQUEADO` según score |
| `Neutral` / `Drawing` | Apto (salvo texto/OCR infractor) | `APROBADO` (con log) |

## Reglas operativas derivadas

1. Ser estricto con `Sexy`: el umbral `porn+sexy` (no `porn` solo) es la
   señal principal de riesgo.
2. El texto visible (OCR) también infringe: pasa siempre por el filtro de
   palabras prohibidas.
3. Video: un solo frame explícito contamina el inventario → basta un frame
   con `porn` alto para bloquear.
4. Zona gris → humano (`PENDIENTE_APROBACION`), nunca auto-publicar dudoso
   ni auto-borrar sin traza.
5. Registrar cada decisión (scores + umbral + versión) para apelaciones.
