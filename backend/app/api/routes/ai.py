import time

from fastapi import APIRouter, File, Form, Request, UploadFile

from app.api.deps import resolve_image
from app.core.errors import InvalidParameters
from app.core.store import store
from app.schemas.cv import ReportRequest
from app.services import vision
from app.services.report import compose_report
from app.utils.timing import elapsed_ms, make_timing

router = APIRouter()


@router.post("/vision-question")
async def vision_question(
    request: Request,
    question: str = Form(...),
    image_id: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    cleaned = question.strip()
    if not cleaned:
        raise InvalidParameters("Enter a question.")
    if len(cleaned) > 1000:
        raise InvalidParameters("Questions are limited to 1000 characters.")
    started = time.perf_counter()
    record = await resolve_image(image_id, file)
    result = await vision.answer(record.image, cleaned)
    processing = elapsed_ms(started)
    store.set_analysis(
        record.image_id,
        "vlm",
        {
            "model": result["model"],
            "answer": result["answer"],
            "verified": False,
        },
    )
    return {
        "image_id": record.image_id,
        "model": result["model"],
        "provider": "openai-compatible",
        "answer": result["answer"],
        "verified": False,
        "resized_for_provider": result["resized_for_provider"],
        "note": result["note"],
        "timing": make_timing(processing, inference_ms=result["inference_ms"], scope="measured"),
        "request_id": request.state.request_id,
    }


@router.post("/report")
async def report(body: ReportRequest, request: Request):
    record = store.get(body.image_id)
    if record is None:
        from app.core.errors import ImageNotFound

        raise ImageNotFound()
    started = time.perf_counter()
    result = await compose_report(record, body)
    scope = "measured" if result["inference_ms"] is not None else (
        "unavailable" if body.use_llm and result["llm_status"] in {"timeout", "failed"} else "not_applicable"
    )
    return {
        "image_id": body.image_id,
        "model": result["model"],
        "llm_model": result["llm_model"],
        "llm_status": result["llm_status"],
        "llm_narrative": result["llm_narrative"],
        "llm_notice": result["llm_notice"],
        "report": result["report"],
        "evidence": result["evidence"],
        "timing": make_timing(elapsed_ms(started), inference_ms=result["inference_ms"], scope=scope),
        "request_id": request.state.request_id,
    }
