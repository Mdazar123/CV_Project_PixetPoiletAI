import logging
import time

from fastapi import APIRouter, File, Form, Request, UploadFile

from app.api.deps import image_shape, parse_candidates, parse_object, resolve_image
from app.core.errors import InvalidParameters
from app.core.store import store
from app.services import detection, ocr, preprocessing, segmentation, similarity
from app.utils.images import encode_png
from app.utils.timing import elapsed_ms, make_timing

logger = logging.getLogger("pixelpilot.cv")
router = APIRouter()


def _with_request(request: Request, payload: dict) -> dict:
    payload["request_id"] = request.state.request_id
    return payload


@router.post("/preprocess")
async def preprocess(
    request: Request,
    operation: str = Form(...),
    parameters: str = Form("{}"),
    image_id: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    started = time.perf_counter()
    record = await resolve_image(image_id, file)
    result = preprocessing.run_operation(record.image.copy(), operation, parse_object(parameters))
    output = result["image"]
    height, width = output.shape[:2]
    channels = 1 if output.ndim == 2 else int(output.shape[2])
    processing = elapsed_ms(started)
    store.set_analysis(
        record.image_id,
        "classical",
        {
            "operation": result["operation"],
            "parameters": result["parameters"],
            "width": int(width),
            "height": int(height),
            "channels": channels,
            "processing_time_ms": processing,
        },
    )
    logger.info("request %s preprocess %s", request.state.request_id, operation)
    return _with_request(
        request,
        {
            "image_id": record.image_id,
            "operation": result["operation"],
            "parameters": result["parameters"],
            "width": int(width),
            "height": int(height),
            "channels": channels,
            "dtype": str(output.dtype),
            "image_base64": encode_png(output),
            "media_type": "image/png",
            "extras": result["extras"],
            "concept_note": result["concept_note"],
            "timing": make_timing(processing, scope="not_applicable"),
        },
    )


@router.post("/detect")
async def detect(
    request: Request,
    confidence: float = Form(0.25),
    max_results: int = Form(20),
    image_id: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    if not 0.01 <= confidence <= 1:
        raise InvalidParameters("Confidence threshold must be between 0.01 and 1.")
    if not 1 <= max_results <= 50:
        raise InvalidParameters("max_results must be between 1 and 50.")
    started = time.perf_counter()
    record = await resolve_image(image_id, file)
    result = detection.detect(record.image, confidence, max_results)
    width, height, _channels = image_shape(record)
    processing = elapsed_ms(started)
    detections = result["detections"]
    store.set_analysis(
        record.image_id,
        "detection",
        {
            "model": result["model"],
            "confidence_threshold": confidence,
            "detection_count": len(detections),
            "detections": detections,
        },
    )
    return _with_request(
        request,
        {
            "image_id": record.image_id,
            "model": result["model"],
            "task": "object-detection",
            "coordinate_system": "absolute_pixels",
            "coordinate_note": "x1 and y1 are inclusive. x2 and y2 are exclusive pixel edges.",
            "image_width": width,
            "image_height": height,
            "confidence_threshold": confidence,
            "detection_count": len(detections),
            "detections": detections,
            "annotated_image_base64": encode_png(result["annotated"]),
            "media_type": "image/png",
            "timing": make_timing(
                processing,
                inference_ms=result["inference_ms"],
                load_ms=result["load_ms"],
                scope="measured",
            ),
            "note": "Boxes and labels come from the detector. A count of zero is a completed result.",
        },
    )


@router.post("/segment")
async def segment(
    request: Request,
    method: str = Form("grabcut"),
    parameters: str = Form("{}"),
    image_id: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    started = time.perf_counter()
    record = await resolve_image(image_id, file)
    result = segmentation.segment(record.image, method, parse_object(parameters))
    width, height, _channels = image_shape(record)
    processing = elapsed_ms(started)
    store.set_analysis(
        record.image_id,
        "segmentation",
        {
            "model": result["model"],
            "method": result["method"],
            "task": result["task"],
            "classes": result["classes"],
        },
    )
    return _with_request(
        request,
        {
            "image_id": record.image_id,
            "model": result["model"],
            "method": result["method"],
            "task": result["task"],
            "image_width": width,
            "image_height": height,
            "classes": result["classes"],
            "rect": result["rect"],
            "overlay_base64": encode_png(result["overlay"]),
            "mask_base64": encode_png(result["mask"]),
            "media_type": "image/png",
            "note": result["note"],
            "timing": make_timing(
                processing,
                inference_ms=result["inference_ms"],
                load_ms=result["load_ms"],
                scope="measured",
            ),
        },
    )


@router.post("/ocr")
async def read_text(
    request: Request,
    image_id: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    started = time.perf_counter()
    record = await resolve_image(image_id, file)
    result = ocr.extract(record.image)
    width, height, _channels = image_shape(record)
    processing = elapsed_ms(started)
    regions = result["text_regions"]
    store.set_analysis(
        record.image_id,
        "ocr",
        {
            "model": result["model"],
            "region_count": len(regions),
            "text_regions": regions,
            "full_text": result["full_text"],
        },
    )
    return _with_request(
        request,
        {
            "image_id": record.image_id,
            "model": result["model"],
            "image_width": width,
            "image_height": height,
            "region_count": len(regions),
            "text_regions": regions,
            "full_text": result["full_text"],
            "timing": make_timing(processing, inference_ms=result["inference_ms"], scope="measured"),
            "note": "Text regions come from the OCR engine. They are separate from any language-model reading of the image.",
        },
    )


@router.post("/similarity")
async def compare_text(
    request: Request,
    candidates: str = Form(...),
    image_id: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    texts = parse_candidates(candidates)
    started = time.perf_counter()
    record = await resolve_image(image_id, file)
    result = similarity.rank(record.image, texts)
    processing = elapsed_ms(started)
    store.set_analysis(
        record.image_id,
        "similarity",
        {
            "model": result["model"],
            "rankings": result["rankings"],
        },
    )
    return _with_request(
        request,
        {
            "image_id": record.image_id,
            "model": result["model"],
            "score_type": "cosine_similarity",
            "score_note": "Scores are cosine similarities in a shared embedding space. They are not calibrated probabilities.",
            "rankings": result["rankings"],
            "device": result["device"],
            "timing": make_timing(
                processing,
                inference_ms=result["inference_ms"],
                load_ms=result["load_ms"],
                scope="measured",
            ),
        },
    )
