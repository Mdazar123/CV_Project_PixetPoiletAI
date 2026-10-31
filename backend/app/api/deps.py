import json
import re

from fastapi import UploadFile

from app.core.config import settings
from app.core.errors import FileTooLarge, ImageNotFound, InvalidParameters
from app.core.store import ImageRecord, store
from app.utils.images import ingest_bytes

IMAGE_ID = re.compile(r"^img_[a-f0-9]{16}$")


async def read_upload(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    size = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        size += len(chunk)
        if size > settings.max_upload_bytes:
            raise FileTooLarge(f"The upload exceeds the {settings.max_upload_bytes} byte limit.")
        chunks.append(chunk)
    if size == 0:
        raise InvalidParameters("The uploaded file is empty.")
    return b"".join(chunks)


async def resolve_image(image_id: str | None, file: UploadFile | None) -> ImageRecord:
    if file is not None and file.filename:
        data = await read_upload(file)
        return ingest_bytes(data, file.filename)
    if image_id:
        if not IMAGE_ID.match(image_id):
            raise InvalidParameters("image_id is not a valid image reference.")
        record = store.get(image_id)
        if record is None:
            raise ImageNotFound()
        return record
    raise InvalidParameters("Upload an image or provide an image_id from inspect.")


def parse_object(raw: str) -> dict:
    try:
        value = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise InvalidParameters("Parameters must be a JSON object.") from exc
    if not isinstance(value, dict):
        raise InvalidParameters("Parameters must be a JSON object.")
    return value


def parse_candidates(raw: str) -> list[str]:
    try:
        value = json.loads(raw or "[]")
    except json.JSONDecodeError as exc:
        raise InvalidParameters("Candidates must be a JSON list of strings.") from exc
    if not isinstance(value, list):
        raise InvalidParameters("Candidates must be a JSON list of strings.")
    texts = []
    for item in value:
        if not isinstance(item, str):
            raise InvalidParameters("Each candidate must be a string.")
        stripped = item.strip()
        if not stripped:
            continue
        if len(stripped) > 200:
            raise InvalidParameters("Each candidate must be 200 characters or fewer.")
        texts.append(stripped)
    if len(texts) < 2 or len(texts) > 8:
        raise InvalidParameters("Provide between 2 and 8 text candidates.")
    return texts


def image_shape(record: ImageRecord) -> tuple[int, int, int]:
    height, width = record.image.shape[:2]
    channels = 1 if record.image.ndim == 2 else int(record.image.shape[2])
    return int(width), int(height), channels
