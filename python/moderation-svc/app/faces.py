"""Detección de rostros adaptada de FaceGuard (`faceguard/engine.py`).

Solo detección (cajas) para moderación: cuenta personas en el frame como
señal complementaria al score NSFW. Sin base de datos ni reconocimiento LBPH
(fase 2 si se necesita).

Degradación elegante (patrón FaceGuard):
  MediaPipe malla -> MediaPipe face_detection -> Haar Cascade -> [].
"""

from __future__ import annotations

import logging

log = logging.getLogger("moderation.faces")

try:
    import cv2

    HAVE_CV2 = True
except Exception:  # pragma: no cover
    cv2 = None  # type: ignore
    HAVE_CV2 = False

try:
    import mediapipe as mp

    HAVE_MEDIAPIPE = True
except Exception:
    mp = None  # type: ignore
    HAVE_MEDIAPIPE = False

HAVE_MP_LEGACY = bool(HAVE_MEDIAPIPE and hasattr(mp, "solutions"))


class FaceDetector:
    """Detector con estado mínimo (cascada + soluciones MediaPipe)."""

    def __init__(self) -> None:
        self.haar = None
        self.mp_detector = None
        self.mp_mesh = None
        if HAVE_CV2:
            try:
                path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                cascade = cv2.CascadeClassifier(path)
                self.haar = None if cascade.empty() else cascade
            except Exception as exc:  # pragma: no cover
                log.warning("Haar no disponible: %s", exc)
        if HAVE_MP_LEGACY:
            try:
                self.mp_detector = mp.solutions.face_detection.FaceDetection(
                    model_selection=0, min_detection_confidence=0.5
                )
                self.mp_mesh = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=True, max_num_faces=5,
                    refine_landmarks=False, min_detection_confidence=0.5,
                )
            except Exception as exc:  # pragma: no cover
                log.warning("MediaPipe no disponible: %s", exc)
                self.mp_detector = self.mp_mesh = None

    def engine(self) -> str:
        if self.mp_mesh is not None or self.mp_detector is not None:
            return "mediapipe"
        if self.haar is not None:
            return "haar"
        return "none"

    def detect(self, image_path: str) -> tuple[list[tuple[int, int, int, int]], str]:
        """Devuelve ([(x,y,w,h)], motor). Sin cv2 -> ([], 'none')."""
        engine = self.engine()
        if not HAVE_CV2:
            return [], engine
        img = cv2.imread(image_path)
        if img is None:
            return [], engine
        h, w = img.shape[:2]

        if self.mp_mesh is not None:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            res = self.mp_mesh.process(rgb)
            if res.multi_face_landmarks:
                boxes = []
                for lm in res.multi_face_landmarks:
                    xs = [p.x * w for p in lm.landmark]
                    ys = [p.y * h for p in lm.landmark]
                    x0, y0 = max(0, int(min(xs))), max(0, int(min(ys)))
                    boxes.append((x0, y0, int(max(xs)) - x0, int(max(ys)) - y0))
                return boxes, engine

        if self.mp_detector is not None:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            res = self.mp_detector.process(rgb)
            boxes = []
            for d in res.detections or []:
                bb = d.location_data.relative_bounding_box
                x, y = max(0, int(bb.xmin * w)), max(0, int(bb.ymin * h))
                fw, fh = min(int(bb.width * w), w - x), min(int(bb.height * h), h - y)
                if fw > 20 and fh > 20:
                    boxes.append((x, y, fw, fh))
            if boxes:
                return boxes, engine

        if self.haar is not None:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)
            found = self.haar.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
            return [(int(x), int(y), int(fw), int(fh)) for (x, y, fw, fh) in found], engine
        return [], engine


_detector: FaceDetector | None = None


def get_detector() -> FaceDetector:
    global _detector
    if _detector is None:
        _detector = FaceDetector()
    return _detector
