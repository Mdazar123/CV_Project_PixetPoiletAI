import logging
import threading
import time

import cv2
import numpy as np

from app.core.config import settings
from app.core.errors import InferenceFailure, ModelUnavailable
from app.utils.images import as_bgr

logger = logging.getLogger("pixelpilot.similarity")

MODEL_NAME = "openclip-vit-b-32-laion2b"
_model = None
_preprocess = None
_tokenizer = None
_lock = threading.Lock()


def status() -> dict:
    try:
        import open_clip  # noqa: F401
    except ImportError:
        return {
            "available": False,
            "model": MODEL_NAME,
            "reason": "Install open_clip_torch from requirements-optional.txt. Similarity scores are not being estimated.",
        }
    return {"available": True, "model": MODEL_NAME, "reason": None}


def rank(image: np.ndarray, texts: list[str]) -> dict:
    current = status()
    if not current["available"]:
        raise ModelUnavailable(current["reason"])
    import torch
    from PIL import Image

    model, preprocess, tokenizer, load_ms = _load()
    device = _device(torch)
    rgb = cv2.cvtColor(as_bgr(image), cv2.COLOR_BGR2RGB)
    image_input = preprocess(Image.fromarray(rgb)).unsqueeze(0).to(device)
    text_input = tokenizer(texts).to(device)
    started = time.perf_counter()
    try:
        with torch.no_grad():
            image_features = model.encode_image(image_input)
            text_features = model.encode_text(text_input)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
            scores = (image_features @ text_features.T).squeeze(0)
    except Exception as exc:
        logger.exception("similarity failed")
        raise InferenceFailure("Image-text similarity failed. No scores were produced.") from exc
    inference_ms = (time.perf_counter() - started) * 1000
    values = scores.detach().cpu().tolist()
    if isinstance(values, float):
        values = [values]
    order = sorted(range(len(texts)), key=lambda index: values[index], reverse=True)
    rankings = [
        {"rank": position + 1, "text": texts[index], "score": round(float(values[index]), 4)}
        for position, index in enumerate(order)
    ]
    return {
        "model": MODEL_NAME,
        "rankings": rankings,
        "device": device,
        "inference_ms": inference_ms,
        "load_ms": load_ms,
    }


def _device(torch) -> str:
    requested = settings.device
    if requested.startswith("cuda") and not torch.cuda.is_available():
        return "cpu"
    return requested


def _load():
    global _model, _preprocess, _tokenizer
    if _model is not None:
        return _model, _preprocess, _tokenizer, None
    with _lock:
        if _model is not None:
            return _model, _preprocess, _tokenizer, None
        import open_clip
        import torch

        started = time.perf_counter()
        try:
            model, _, preprocess = open_clip.create_model_and_transforms(
                "ViT-B-32",
                pretrained="laion2b_s34b_b79k",
            )
            tokenizer = open_clip.get_tokenizer("ViT-B-32")
            model = model.to(_device(torch))
            model.eval()
        except Exception as exc:
            logger.exception("similarity model load failed")
            raise InferenceFailure("The similarity model could not be loaded. No scores were produced.") from exc
        _model = model
        _preprocess = preprocess
        _tokenizer = tokenizer
        return _model, _preprocess, _tokenizer, (time.perf_counter() - started) * 1000
