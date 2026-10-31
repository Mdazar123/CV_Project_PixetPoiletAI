from fastapi import APIRouter

from app.core.config import settings
from app.services import detection, ocr, segmentation, similarity, vision

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.version,
    }


@router.get("/capabilities")
def capabilities() -> dict:
    return {
        "classical": {"available": True, "operations": [
            "grayscale",
            "gaussian_blur",
            "threshold",
            "canny",
            "contours",
            "erosion",
            "dilation",
            "opening",
            "closing",
            "resize",
            "rotate",
            "crop",
            "flip",
        ]},
        "detector": detection.status(),
        "segmentation": segmentation.status(),
        "ocr": ocr.status(),
        "similarity": similarity.status(),
        "vlm": vision.status(),
        "llm": {
            "configured": vision.status()["configured"],
            "model": settings.llm_model if vision.status()["configured"] else None,
            "reason": None if vision.status()["configured"] else "Set OPENAI_API_KEY to add a language-model narrative.",
        },
        "storage": "Images and analysis records stay in server memory for this process and expire automatically.",
    }
