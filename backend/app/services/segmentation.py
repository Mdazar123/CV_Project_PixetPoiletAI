import logging
import threading
import time

import cv2
import numpy as np
from pydantic import ValidationError

from app.core import model_slots
from app.core.config import settings
from app.core.errors import InferenceFailure, InvalidParameters, ModelUnavailable
from app.schemas.cv import DeepLabParams, GrabCutParams
from app.utils.images import as_bgr

logger = logging.getLogger("pixelpilot.segmentation")

DEEPLAB_NAME = "mediapipe-deeplab-v3"
GRABCUT_NAME = "opencv-grabcut"
PASCAL_LABELS = [
    "background",
    "aeroplane",
    "bicycle",
    "bird",
    "boat",
    "bottle",
    "bus",
    "car",
    "cat",
    "chair",
    "cow",
    "dining table",
    "dog",
    "horse",
    "motorbike",
    "person",
    "potted plant",
    "sheep",
    "sofa",
    "train",
    "tv",
]
PALETTE_RGB = [
    (28, 32, 38),
    (230, 25, 75),
    (60, 180, 75),
    (255, 225, 25),
    (0, 130, 200),
    (245, 130, 48),
    (145, 30, 180),
    (70, 240, 240),
    (240, 50, 230),
    (210, 245, 60),
    (250, 190, 212),
    (0, 128, 128),
    (220, 190, 255),
    (170, 110, 40),
    (255, 250, 200),
    (128, 0, 0),
    (170, 255, 195),
    (128, 128, 0),
    (255, 215, 180),
    (0, 0, 128),
    (128, 128, 128),
]

_segmenter = None
_lock = threading.Lock()


def status() -> dict:
    reason = _deeplab_reason()
    return {
        "grabcut": {"available": True, "model": GRABCUT_NAME, "reason": None},
        "deeplab": {"available": reason is None, "model": DEEPLAB_NAME, "reason": reason},
    }


def _deeplab_reason() -> str | None:
    try:
        import mediapipe  # noqa: F401
    except ImportError:
        return "The mediapipe package is not installed."
    if not settings.segmenter_path.exists():
        return "The DeepLabV3 model file is missing. Run python scripts/download_models.py."
    return None


def _validation_message(exc: ValidationError) -> str:
    parts = []
    for error in exc.errors():
        loc = ".".join(str(item) for item in error.get("loc", []))
        message = error.get("msg", "Invalid value")
        parts.append(f"{loc}: {message}" if loc else message)
    return "; ".join(parts) or "The parameters are invalid."


def segment(image: np.ndarray, method: str, parameters: dict) -> dict:
    if method == "grabcut":
        try:
            params = GrabCutParams.model_validate(parameters)
        except ValidationError as exc:
            raise InvalidParameters(_validation_message(exc)) from exc
        return _grabcut(image, params)
    if method == "deeplab":
        try:
            DeepLabParams.model_validate(parameters)
        except ValidationError as exc:
            raise InvalidParameters(_validation_message(exc)) from exc
        return _deeplab(image)
    raise InvalidParameters("Unsupported segmentation method. Use grabcut or deeplab.")


def _resolve_rect(image: np.ndarray, params: GrabCutParams) -> tuple[int, int, int, int]:
    height, width = image.shape[:2]
    values = (params.x, params.y, params.width, params.height)
    if all(value is None for value in values):
        margin_x = max(1, int(round(width * 0.1)))
        margin_y = max(1, int(round(height * 0.1)))
        rect = (margin_x, margin_y, width - (2 * margin_x), height - (2 * margin_y))
    elif any(value is None for value in values):
        raise InvalidParameters("Provide x, y, width, and height together, or leave the rectangle empty.")
    else:
        rect = (int(params.x), int(params.y), int(params.width), int(params.height))
    x, y, rect_width, rect_height = rect
    if rect_width < 2 or rect_height < 2:
        raise InvalidParameters("The GrabCut rectangle is too small.")
    if x < 0 or y < 0 or x + rect_width > width or y + rect_height > height:
        raise InvalidParameters(f"The GrabCut rectangle is outside the {width}×{height} image.")
    return rect


def _grabcut(image: np.ndarray, params: GrabCutParams) -> dict:
    color = as_bgr(image).copy()
    rect = _resolve_rect(color, params)
    mask = np.zeros(color.shape[:2], np.uint8)
    background = np.zeros((1, 65), np.float64)
    foreground = np.zeros((1, 65), np.float64)
    started = time.perf_counter()
    try:
        cv2.grabCut(color, mask, rect, background, foreground, params.iterations, cv2.GC_INIT_WITH_RECT)
    except cv2.error as exc:
        logger.exception("grabcut failed")
        raise InferenceFailure("GrabCut could not segment this image. No mask was produced.") from exc
    inference_ms = (time.perf_counter() - started) * 1000
    foreground_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), np.uint8(255), np.uint8(0))
    classes = [
        {
            "class_id": 1,
            "label": "foreground",
            "pixel_count": int(np.count_nonzero(foreground_mask)),
        },
        {
            "class_id": 0,
            "label": "background",
            "pixel_count": int(foreground_mask.size - np.count_nonzero(foreground_mask)),
        },
    ]
    x, y, rect_width, rect_height = rect
    return {
        "model": GRABCUT_NAME,
        "method": "grabcut",
        "task": "classical-foreground",
        "classes": classes,
        "overlay": _overlay(color, foreground_mask > 0, (94, 224, 181)),
        "mask": _binary_preview(foreground_mask),
        "rect": {"x": x, "y": y, "width": rect_width, "height": rect_height},
        "note": "GrabCut separates a foreground region inside the rectangle. It is a classical algorithm, and the rectangle is part of the input.",
        "inference_ms": inference_ms,
        "load_ms": None,
    }


def release() -> None:
    global _segmenter
    with _lock:
        if _segmenter is None:
            return
        try:
            _segmenter.close()
        except Exception:
            logger.warning("segmenter close failed", exc_info=True)
        _segmenter = None


def _load_segmenter():
    global _segmenter
    if _segmenter is not None:
        return _segmenter, None
    if settings.low_memory:
        model_slots.release_others("segmenter")
    with _lock:
        if _segmenter is not None:
            return _segmenter, None
        import mediapipe as mp

        options = mp.tasks.vision.ImageSegmenterOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(settings.segmenter_path)),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            output_category_mask=True,
        )
        started = time.perf_counter()
        try:
            _segmenter = mp.tasks.vision.ImageSegmenter.create_from_options(options)
        except Exception as exc:
            logger.exception("segmenter load failed")
            raise InferenceFailure("The segmentation model could not be loaded. No mask was produced.") from exc
        return _segmenter, (time.perf_counter() - started) * 1000


model_slots.register("segmenter", release)


def _deeplab(image: np.ndarray) -> dict:
    reason = _deeplab_reason()
    if reason:
        raise ModelUnavailable(reason + " No mask was produced.")
    segmenter, load_ms = _load_segmenter()
    import mediapipe as mp

    color = as_bgr(image)
    rgb = np.ascontiguousarray(cv2.cvtColor(color, cv2.COLOR_BGR2RGB))
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    started = time.perf_counter()
    try:
        result = segmenter.segment(mp_image)
    except Exception as exc:
        logger.exception("deeplab inference failed")
        raise InferenceFailure("Semantic segmentation failed. No mask was produced.") from exc
    inference_ms = (time.perf_counter() - started) * 1000
    if result.category_mask is None:
        raise InferenceFailure("The segmentation model returned no category mask.")
    mask = np.squeeze(result.category_mask.numpy_view()).astype(np.uint8)
    height, width = color.shape[:2]
    resized = False
    if mask.shape[:2] != (height, width):
        mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_NEAREST)
        resized = True
    classes = []
    class_ids = [int(class_id) for class_id in np.unique(mask)]
    for class_id in class_ids:
        label = PASCAL_LABELS[class_id] if 0 <= class_id < len(PASCAL_LABELS) else f"class_{class_id}"
        classes.append(
            {
                "class_id": class_id,
                "label": label,
                "pixel_count": int(np.count_nonzero(mask == class_id)),
            }
        )
    classes.sort(key=lambda item: item["pixel_count"], reverse=True)
    note = "DeepLabV3 assigns one Pascal VOC class to each pixel, including background. It does not separate instances of the same class."
    if resized:
        note += " The mask was resized with nearest-neighbor sampling to the input dimensions."
    return {
        "model": DEEPLAB_NAME,
        "method": "deeplab",
        "task": "semantic-segmentation",
        "classes": classes,
        "overlay": _class_overlay(color, mask),
        "mask": _class_mask(mask),
        "rect": None,
        "note": note,
        "inference_ms": inference_ms,
        "load_ms": load_ms,
    }


def _overlay(image: np.ndarray, region: np.ndarray, bgr: tuple[int, int, int]) -> np.ndarray:
    overlay = image.copy()
    color = np.zeros_like(overlay)
    color[:] = bgr
    blended = cv2.addWeighted(overlay, 0.55, color, 0.45, 0)
    overlay[region] = blended[region]
    return overlay


def _class_overlay(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    overlay = image.copy()
    for class_id in np.unique(mask):
        class_id = int(class_id)
        if class_id == 0:
            continue
        region = mask == class_id
        color = np.array(_bgr(class_id), dtype=np.uint8)
        blended = (overlay[region].astype(np.float32) * 0.55) + (color.astype(np.float32) * 0.45)
        overlay[region] = blended.astype(np.uint8)
    return overlay


def _class_mask(mask: np.ndarray) -> np.ndarray:
    preview = np.zeros((*mask.shape[:2], 3), dtype=np.uint8)
    for class_id in np.unique(mask):
        preview[mask == class_id] = _bgr(int(class_id))
    return preview


def _binary_preview(mask: np.ndarray) -> np.ndarray:
    preview = np.zeros((*mask.shape[:2], 3), dtype=np.uint8)
    preview[mask == 0] = (28, 32, 38)
    preview[mask > 0] = (94, 224, 181)
    return preview


def _bgr(class_id: int) -> tuple[int, int, int]:
    if 0 <= class_id < len(PALETTE_RGB):
        red, green, blue = PALETTE_RGB[class_id]
    else:
        red, green, blue = ((class_id * 47) % 255, 180, 90)
    return (blue, green, red)
