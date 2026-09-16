"""Esquemas del microservicio de moderación."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ImageRef(BaseModel):
    image_path: str = Field(description="Ruta local de la imagen (volumen montado)")


class FaceBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class FacesResponse(BaseModel):
    count: int
    boxes: list[FaceBox]
    engine: str = Field(description="Motor efectivo: mediapipe | haar | none")


class OcrResponse(BaseModel):
    text: str
    engine: str = Field(description="easyocr | none")


class NsfwScores(BaseModel):
    porn: float = 0.0
    sexy: float = 0.0
    hentai: float = 0.0
    neutral: float = 1.0
    drawing: float = 0.0
