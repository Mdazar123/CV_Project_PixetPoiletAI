import logging
import threading
import time

import cv2
import numpy as np

from app.core.config import settings
from app.core.errors import InferenceFailure, ModelUnavailable
from app.utils.images import as_bgr

logger = logging.getLogger("pixelpilot.detection")

MODEL_NAME = "mediapipe-efficientdet-lite0-int8"
_detector = None
_lock = threading.Lock()


def clip_bbox(x1: float, y1: float, x2: float, y2: float, width: int, height: int) -> dict | None:
    left = max(0, min(int(round(x1)), width))
    top = max(0, min(int(round(y1)), height))
    right = max(0, min(int(round(x2)), width))
    bottom = max(0, min(int(round(y2)), height))
    if right <= left or bottom <= top:
        return None
    return {"x1": left, "y1": top, "x2": right, "y2": bottom}


def status() -> dict:
    reason = _unavailable_reason()
    return {
        "available": reason is None,
        "model": MODEL_NAME,
        "task": "object-detection",
        "reason": reason,
    }


def _unavailable_reason() -> str | None:
    try:
        import mediapipe  # noqa: F401
    except ImportError:
        return "The mediapipe package is not installed."
    if not settings.detector_path.exists():
        return "The EfficientDet model file is missing. Run python scripts/download_models.py."
    return None


def _load_detector():
    global _detector
    if _detector is not None:
        return _detector, None
    with _lock:
        if _detector is not None:
            return _detector, None
        import mediapipe as mp

        options = mp.tasks.vision.ObjectDetectorOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(settings.detector_path)),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            score_threshold=0.01,
            max_results=50,
        )
        started = time.perf_counter()
        try:
            _detector = mp.tasks.vision.ObjectDetector.create_from_options(options)
        except Exception as exc:
            logger.exception("detector load failed")
            raise InferenceFailure("The detection model could not be loaded. No detections were produced.") from exc
        return _detector, (time.perf_counter() - started) * 1000


def detect(image: np.ndarray, confidence: float, max_results: int) -> dict:
    reason = _unavailable_reason()
    if reason:
        raise ModelUnavailable(reason + " No detections were produced.")
    detector, load_ms = _load_detector()
    import mediapipe as mp

    rgb = np.ascontiguousarray(cv2.cvtColor(as_bgr(image), cv2.COLOR_BGR2RGB))
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    started = time.perf_counter()
    try:
        result = detector.detect(mp_image)
    except Exception as exc:
        logger.exception("detector inference failed")
        raise InferenceFailure("Object detection failed. No detections were produced.") from exc
    inference_ms = (time.perf_counter() - started) * 1000

    height, width = image.shape[:2]
    detections = []
    for detection in result.detections:
        if not detection.categories:
            continue
        category = max(detection.categories, key=lambda item: item.score or 0)
        score = float(category.score or 0)
        if score < confidence:
            continue
        box = detection.bounding_box
        clipped = clip_bbox(
            box.origin_x,
            box.origin_y,
            box.origin_x + box.width,
            box.origin_y + box.height,
            width,
            height,
        )
        if clipped is None:
            continue
        raw_index = getattr(category, "index", None)
        class_id = -1 if raw_index is None else int(raw_index)
        label = (category.category_name or getattr(category, "display_name", "") or "").strip()
        if not label:
            label = "unknown" if class_id < 0 else f"class_{class_id}"
        detections.append(
            {
                "class_id": class_id,
                "label": label,
                "confidence": round(score, 4),
                "bbox": clipped,
            }
        )
    detections.sort(key=lambda item: item["confidence"], reverse=True)
    detections = detections[:max_results]
    return {
        "model": MODEL_NAME,
        "detections": detections,
        "annotated": draw_detections(image, detections),
        "inference_ms": inference_ms,
        "load_ms": load_ms,
    }


def draw_detections(image: np.ndarray, detections: list[dict]) -> np.ndarray:
    canvas = as_bgr(image).copy()
    for detection in detections:
        box = detection["bbox"]
        x1, y1, x2, y2 = box["x1"], box["y1"], box["x2"], box["y2"]
        color = (94, 224, 181)
        cv2.rectangle(canvas, (x1, y1), (max(x1, x2 - 1), max(y1, y2 - 1)), color, 2)
        text = f"{detection['label']} {detection['confidence']:.2f}"
        scale = max(0.45, min(canvas.shape[1], canvas.shape[0]) / 900)
        thickness = 1
        (text_width, text_height), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
        top = max(0, y1 - text_height - baseline - 6)
        cv2.rectangle(
            canvas,
            (x1, top),
            (min(canvas.shape[1] - 1, x1 + text_width + 8), min(canvas.shape[0] - 1, top + text_height + baseline + 6)),
            color,
            -1,
        )
        cv2.putText(
            canvas,
            text,
            (x1 + 4, top + text_height + 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            scale,
            (16, 24, 20),
            thickness,
            cv2.LINE_AA,
        )
    return canvas
