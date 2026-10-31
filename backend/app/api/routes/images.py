import time

from fastapi import APIRouter, File, Request, UploadFile

from app.api.deps import read_upload
from app.core.errors import ImageNotFound, InvalidParameters
from app.core.store import store
from app.schemas.cv import PixelQuery
from app.utils.images import describe, ingest_bytes, sample_pixels
from app.utils.timing import elapsed_ms

router = APIRouter()


@router.post("/inspect")
async def inspect_image(request: Request, file: UploadFile = File(...)):
    started = time.perf_counter()
    if not file.filename:
        raise InvalidParameters("Choose an image file.")
    data = await read_upload(file)
    record = ingest_bytes(data, file.filename)
    payload = describe(record)
    payload["processing_time_ms"] = elapsed_ms(started)
    payload["request_id"] = request.state.request_id
    payload["note"] = (
        "Color images are stored as BGR arrays after decoding. "
        "JPEG orientation is applied before analysis so pixel coordinates match the preview."
    )
    return payload


@router.post("/{image_id}/pixels")
async def pixels(image_id: str, body: PixelQuery, request: Request):
    record = store.get(image_id)
    if record is None:
        raise ImageNotFound()
    sampled = sample_pixels(record.image, body.x, body.y, body.width, body.height)
    note = (
        "OpenCV-style color images in this API use BGR order. RGB is the same pixel shown in display order."
        if record.color_space == "BGR"
        else "This image has one channel."
    )
    return {
        "image_id": record.image_id,
        "width": int(record.image.shape[1]),
        "height": int(record.image.shape[0]),
        "color_space": record.color_space,
        "note": note,
        "pixels": sampled,
        "request_id": request.state.request_id,
    }


@router.delete("/{image_id}")
async def delete_image(image_id: str):
    if not store.delete(image_id):
        raise ImageNotFound()
    return {"deleted": True, "image_id": image_id}
