import logging
import threading

import numpy as np

from app.core.errors import InferenceFailure, ModelUnavailable
from app.utils.images import as_bgr

logger = logging.getLogger("pixelpilot.ocr")

_engine = None
_lock = threading.Lock()


def status() -> dict:
    if _importable("rapidocr_onnxruntime"):
        return {"available": True, "model": "rapidocr-onnxruntime", "reason": None}
    if _importable("pytesseract"):
        return {
            "available": True,
            "model": "pytesseract",
            "reason": "The Tesseract program must be available on PATH.",
        }
    return {
        "available": False,
        "model": None,
        "reason": "Install rapidocr-onnxruntime, or install pytesseract and the Tesseract program.",
    }


def _importable(name: str) -> bool:
    try:
        __import__(name)
        return True
    except ImportError:
        return False


def extract(image: np.ndarray) -> dict:
    current = status()
    if not current["available"]:
        raise ModelUnavailable(current["reason"] + " No text was extracted.")
    if current["model"] == "rapidocr-onnxruntime":
        regions, inference_ms = _rapidocr(image)
        model = "rapidocr-onnxruntime"
    else:
        regions, inference_ms = _tesseract(image)
        model = "pytesseract"
    full_text = "\n".join(region["text"] for region in regions)
    return {
        "model": model,
        "text_regions": regions,
        "full_text": full_text,
        "inference_ms": inference_ms,
    }


def _rapidocr(image: np.ndarray) -> tuple[list[dict], float]:
    import time

    from rapidocr_onnxruntime import RapidOCR

    global _engine
    with _lock:
        if _engine is None:
            _engine = RapidOCR()
        engine = _engine
    started = time.perf_counter()
    try:
        result, _elapsed = engine(as_bgr(image))
    except Exception as exc:
        logger.exception("rapidocr failed")
        raise InferenceFailure("OCR failed. No text was extracted.") from exc
    inference_ms = (time.perf_counter() - started) * 1000
    regions = []
    for item in result or []:
        if not item or len(item) < 2:
            continue
        box, text = item[0], str(item[1]).strip()
        if not text:
            continue
        score = float(item[2]) if len(item) > 2 and item[2] is not None else None
        xs = [float(point[0]) for point in box]
        ys = [float(point[1]) for point in box]
        regions.append(
            {
                "text": text,
                "confidence": None if score is None else round(score, 4),
                "bbox": {
                    "x1": int(round(min(xs))),
                    "y1": int(round(min(ys))),
                    "x2": int(round(max(xs))),
                    "y2": int(round(max(ys))),
                },
            }
        )
    return regions, inference_ms


def _tesseract(image: np.ndarray) -> tuple[list[dict], float]:
    import time

    import cv2
    import pytesseract

    rgb = cv2.cvtColor(as_bgr(image), cv2.COLOR_BGR2RGB)
    started = time.perf_counter()
    try:
        data = pytesseract.image_to_data(rgb, output_type=pytesseract.Output.DICT)
    except pytesseract.TesseractNotFoundError as exc:
        raise ModelUnavailable(
            "Tesseract is not available on PATH. No text was extracted."
        ) from exc
    except Exception as exc:
        logger.exception("tesseract failed")
        raise InferenceFailure("OCR failed. No text was extracted.") from exc
    inference_ms = (time.perf_counter() - started) * 1000
    regions = []
    for index, text in enumerate(data.get("text", [])):
        cleaned = str(text).strip()
        if not cleaned:
            continue
        raw_confidence = float(data["conf"][index])
        confidence = None if raw_confidence < 0 else round(raw_confidence / 100, 4)
        x = int(data["left"][index])
        y = int(data["top"][index])
        width = int(data["width"][index])
        height = int(data["height"][index])
        regions.append(
            {
                "text": cleaned,
                "confidence": confidence,
                "bbox": {"x1": x, "y1": y, "x2": x + width, "y2": y + height},
            }
        )
    return regions, inference_ms
