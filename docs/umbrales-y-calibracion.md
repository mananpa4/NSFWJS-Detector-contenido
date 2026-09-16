# Umbrales y calibración

## Valores vigentes (`THRESHOLDS_VERSION`)

Fuente única: `packages/api/src/config/thresholds.ts`.

| Umbral | Valor inicial | Significado |
|---|---|---|
| `risky` (porn+sexy) | 0.35 | ≥ esto → riesgoso |
| `blockPorn` | 0.5 | ≥ esto → bloqueado directo |
| `blockHentai` | 0.5 | ≥ esto → bloqueado directo |
| `reviewMin` | 0.20 | desde aquí → zona gris |
| `videoReviewRatio` | 0.10 | >10% frames riesgosos → pendiente |
| `videoBlockRatio` | 0.30 | >30% → bloqueado |
| `videoBlockSinglePorn` | 0.8 | un frame así → bloqueado |
| `textReviewHits` | 1 | 1 hit → pendiente |
| `textBlockHits` | 3 | 3+ hits → bloqueado |

## Cómo calibrar

```bash
# 1. Etiqueta una muestra (solo sintética o con licencia): porn,sexy,label
python scripts/calibrate-thresholds.py --csv muestra.csv
# 2. Elige el umbral con mejor F1 sesgado a recall (falsos negativos = riesgo AdSense)
# 3. Actualiza thresholds.ts + registra en CLAUDE_CONTEXT.md
```

`--demo` ejecuta con datos sintéticos para probar el flujo.

## Historial de cambios

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-09-16 | Valores iniciales v0.1.0 | Política estricta AdSense; sin validar empíricamente |
