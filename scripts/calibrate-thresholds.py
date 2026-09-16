#!/usr/bin/env python3
"""Calibra el umbral `porn+sexy >= risky` contra etiquetas humanas.

Entrada CSV: columnas `porn,sexy,label` con label en {0,1}.
  python scripts/calibrate-thresholds.py --csv data.csv
  python scripts/calibrate-thresholds.py --demo   # datos sintéticos

Solo stdlib. Imprime precisión/recall/F1 por umbral y sugiere el mejor F1.
El resultado se documenta en docs/umbrales-y-calibracion.md y el umbral
elegido vive en packages/api/src/config/thresholds.ts (nunca aquí).
"""

from __future__ import annotations

import argparse
import csv
import random
import sys


def metrics(rows: list[tuple[float, int]], thr: float) -> tuple[float, float, float]:
    tp = fp = fn = 0
    for score, label in rows:
        pred = score >= thr
        if pred and label == 1:
            tp += 1
        elif pred:
            fp += 1
        elif label == 1:
            fn += 1
    precision = tp / (tp + fp) if (tp + fp) else 1.0
    recall = tp / (tp + fn) if (tp + fn) else 1.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return precision, recall, f1


def demo_rows(n: int = 400, seed: int = 7) -> list[tuple[float, int]]:
    rng = random.Random(seed)
    rows: list[tuple[float, int]] = []
    for _ in range(n):
        if rng.random() < 0.3:  # positivo: score alto con ruido
            rows.append((min(1.0, rng.gauss(0.62, 0.18)), 1))
        else:  # negativo: score bajo con cola
            rows.append((max(0.0, rng.gauss(0.12, 0.10)), 0))
    return rows


def load_csv(path: str) -> list[tuple[float, int]]:
    rows: list[tuple[float, int]] = []
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            rows.append((float(row["porn"]) + float(row["sexy"]), int(row["label"])))
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=None)
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--from-thr", type=float, default=0.10)
    ap.add_argument("--to-thr", type=float, default=0.60)
    ap.add_argument("--step", type=float, default=0.05)
    args = ap.parse_args()

    if args.demo:
        rows = demo_rows()
    elif args.csv:
        rows = load_csv(args.csv)
    else:
        ap.error("usa --csv data.csv o --demo")
        return 2

    print(f"muestras={len(rows)} positivos={sum(l for _, l in rows)}")
    print(f"{'thr':>6} {'prec':>7} {'rec':>7} {'f1':>7}")
    best = (0.0, 0.0)
    thr = args.from_thr
    while thr <= args.to_thr + 1e-9:
        p, r, f1 = metrics(rows, thr)
        print(f"{thr:6.2f} {p:7.3f} {r:7.3f} {f1:7.3f}")
        if f1 > best[1]:
            best = (thr, f1)
        thr += args.step
    print(f"sugerido: risky={best[0]:.2f} (F1={best[1]:.3f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
