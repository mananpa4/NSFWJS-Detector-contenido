"""Smoke test sin dependencias: degradación elegante sin cv2/easyocr.

Ejecutar:  python tests/smoke_no_deps.py
Requiere solo stdlib. Verifica que los módulos importan y responden
vacíos (no excepciones) cuando faltan las dependencias pesadas.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import faces, ocr  # noqa: E402


def main() -> None:
    det = faces.get_detector()
    print("faces engine:", det.engine())
    boxes, engine = det.detect("no-existe.jpg")
    assert boxes == [], f"esperado [] sin cv2, fue {boxes}"
    assert engine in ("mediapipe", "haar", "none")

    text = ocr.read_text("no-existe.jpg")
    assert isinstance(text, str)
    print("ocr engine:", ocr.engine(), "| text:", repr(text[:60]))
    print("SMOKE OK")


if __name__ == "__main__":
    main()
