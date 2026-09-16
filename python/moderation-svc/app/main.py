"""Microservicio Python de moderación: rostros + OCR + clasificación pesada.

Contrato:
  POST /detect/faces  {image_path} -> {count, boxes, engine}
  POST /ocr           {image_path} -> {text, engine}
  POST /classify      {image_path} -> {scores}  (TODO: ONNX SafeVision/ViT)
  GET  /health -> capabilities (qué motores hay realmente instalados)
"""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from . import faces, ocr
from .schemas import FaceBox, FacesResponse, ImageRef, NsfwScores, OcrResponse

log = logging.getLogger("moderation.main")
app = FastAPI(title="moderation-svc", version="0.1.0")


class ClassifyResponse(BaseModel):
    scores: NsfwScores
    engine: str
    latency_ms: int


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "faces": faces.get_detector().engine(),
        "ocr": ocr.engine(),
        "classify": "none",  # TODO: onnx (safevision/vit)
    }


@app.post("/detect/faces", response_model=FacesResponse)
def detect_faces(ref: ImageRef) -> FacesResponse:
    try:
        boxes, engine = faces.get_detector().detect(ref.image_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return FacesResponse(
        count=len(boxes),
        boxes=[FaceBox(x=x, y=y, w=w, h=h) for (x, y, w, h) in boxes],
        engine=engine,
    )


@app.post("/ocr", response_model=OcrResponse)
def do_ocr(ref: ImageRef) -> OcrResponse:
    return OcrResponse(text=ocr.read_text(ref.image_path), engine=ocr.engine())


@app.post("/classify", response_model=ClassifyResponse)
def classify(ref: ImageRef) -> ClassifyResponse:
    """TODO(vibecoding): batch ONNX (SafeVision) o ViT HF vía onnxruntime."""
    started = time.time()
    _ = ref.image_path
    return ClassifyResponse(
        scores=NsfwScores(),
        engine="none",
        latency_ms=int((time.time() - started) * 1000),
    )
