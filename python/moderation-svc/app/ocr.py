"""OCR con EasyOCR (lazy). Sin la dependencia -> texto vacío, sin error.

El texto devuelto se pasa al filtro de palabras prohibidas (embedded, en la
API Node). Este servicio no censura: solo extrae.
"""

from __future__ import annotations

import logging

log = logging.getLogger("moderation.ocr")

try:
    import easyocr  # type: ignore

    HAVE_EASYOCR = True
except Exception:
    easyocr = None  # type: ignore
    HAVE_EASYOCR = False

_reader = None


def engine() -> str:
    return "easyocr" if HAVE_EASYOCR else "none"


def read_text(image_path: str, langs: list[str] | None = None) -> str:
    """Extrae texto o '' si EasyOCR no está instalado."""
    global _reader
    if not HAVE_EASYOCR:
        return ""
    try:
        if _reader is None:
            _reader = easyocr.Reader(list(langs or ["es", "en"]), gpu=False)
        found = _reader.readtext(image_path, detail=0)
        return " ".join(str(t) for t in found)
    except Exception as exc:
        log.warning("OCR falló: %s", exc)
        return ""
