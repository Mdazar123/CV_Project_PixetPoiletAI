import base64
import io
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import (
    FileTooLarge,
    ImageDecodeError,
    ImageTooLarge,
    InferenceFailure,
    PixelPilotError,
    UnsupportedImage,
)
from app.core.store import ImageRecord, store

EXT_FORMAT = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}


def sniff_format(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "JPEG"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "WEBP"
    return None


def validate_container(data: bytes, filename: str) -> str:
    expected = EXT_FORMAT.get(Path(filename or "").suffix.lower())
    if expected is None:
        raise UnsupportedImage("Use a JPEG, PNG, or WebP file. Other formats are rejected.")
    actual = sniff_format(data)
    if actual is None:
        raise UnsupportedImage("The file content does not match a supported image format.")
    if actual != expected:
        raise UnsupportedImage(f"The file extension says {expected}, but the content is {actual}.")
    if actual == "WEBP" and b"ANIM" in data:
        raise UnsupportedImage("Animated images are not supported.")
    return actual


def decode_image(data: bytes) -> tuple[np.ndarray, bool]:
    try:
        with Image.open(io.BytesIO(data)) as incoming:
            incoming.load()
            oriented = ImageOps.exif_transpose(incoming)
            alpha_discarded = False
            if oriented is None:
                raise ImageDecodeError()
            if oriented.mode == "RGBA":
                alpha_discarded = True
                oriented = oriented.convert("RGB")
            elif oriented.mode == "L":
                array = np.ascontiguousarray(np.array(oriented))
                _check_dimensions(array)
                return array, False
            elif oriented.mode != "RGB":
                oriented = oriented.convert("RGB")
            rgb = np.ascontiguousarray(np.array(oriented))
            if rgb.ndim != 3 or rgb.shape[2] != 3:
                raise ImageDecodeError("The decoded image does not have a supported channel layout.")
            bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
            _check_dimensions(bgr)
            return bgr, alpha_discarded
    except PixelPilotError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageDecodeError() from exc


def _check_dimensions(image: np.ndarray) -> None:
    height, width = image.shape[:2]
    if width < 2 or height < 2:
        raise ImageDecodeError("The image is too small to analyze.")
    if (
        width > settings.max_image_side
        or height > settings.max_image_side
        or width * height > settings.max_pixels
    ):
        raise ImageTooLarge(
            f"Images must be at most {settings.max_image_side} pixels on a side."
        )


def ingest_bytes(data: bytes, filename: str) -> ImageRecord:
    if len(data) > settings.max_upload_bytes:
        raise FileTooLarge(f"The upload exceeds the {settings.max_upload_bytes} byte limit.")
    file_format = validate_container(data, filename)
    image, alpha_discarded = decode_image(data)
    color_space = "GRAY" if image.ndim == 2 else "BGR"
    return store.put(
        image=image,
        file_format=file_format,
        file_size_bytes=len(data),
        color_space=color_space,
        alpha_discarded=alpha_discarded,
    )


def describe(record: ImageRecord) -> dict:
    image = record.image
    height, width = image.shape[:2]
    channels = 1 if image.ndim == 2 else int(image.shape[2])
    return {
        "image_id": record.image_id,
        "width": int(width),
        "height": int(height),
        "channels": channels,
        "dtype": str(image.dtype),
        "format": record.file_format,
        "file_size_bytes": record.file_size_bytes,
        "color_space": record.color_space,
        "alpha_discarded": record.alpha_discarded,
    }


def as_gray(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def as_bgr(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    return image


def encode_png(image: np.ndarray) -> str:
    output = image
    if output.dtype != np.uint8:
        output = np.clip(output, 0, 255).astype(np.uint8)
    ok, buffer = cv2.imencode(".png", output)
    if not ok:
        raise InferenceFailure("The processed image could not be encoded.")
    return base64.b64encode(buffer.tobytes()).decode("ascii")


def sample_pixels(image: np.ndarray, x: int, y: int, width: int, height: int) -> list[dict]:
    from app.core.errors import InvalidParameters

    image_height, image_width = image.shape[:2]
    if width < 1 or height < 1 or width > 16 or height > 16:
        raise InvalidParameters("Pixel region width and height must be from 1 to 16.")
    if x < 0 or y < 0 or x + width > image_width or y + height > image_height:
        raise InvalidParameters("That pixel region is outside the image.")
    crop = image[y : y + height, x : x + width]
    gray = image.ndim == 2
    pixels: list[dict] = []
    for row in range(height):
        for col in range(width):
            value = crop[row, col]
            point = {"x": x + col, "y": y + row}
            if gray:
                point["gray"] = int(value)
            else:
                blue, green, red = (int(channel) for channel in value[:3])
                point["bgr"] = [blue, green, red]
                point["rgb"] = [red, green, blue]
            pixels.append(point)
    return pixels
