import cv2
import numpy as np
from pydantic import ValidationError

from app.core.errors import InvalidParameters
from app.schemas.cv import OPERATION_MODELS
from app.utils.images import as_bgr, as_gray

CONCEPT_NOTES = {
    "grayscale": "Grayscale stores one luminance value per pixel. Color images in this workbench are BGR in memory before conversion.",
    "gaussian_blur": "A Gaussian kernel averages each pixel with its neighbors and weights the center more heavily. Larger kernels remove more noise and more detail.",
    "threshold": "Thresholding splits pixels into two groups. A global cutoff is sensitive to uneven lighting. Adaptive thresholding uses a local neighborhood.",
    "canny": "Canny finds strong intensity changes, suppresses weak ones, and links the survivors with hysteresis thresholds.",
    "contours": "Contours trace connected boundaries in a binary image. Area and bounding rectangles measure those boundaries. Their quality depends on the threshold or edges used first.",
    "erosion": "Erosion shrinks bright regions. A larger kernel and more iterations remove more foreground.",
    "dilation": "Dilation expands bright regions and can bridge small gaps.",
    "opening": "Opening erodes and then dilates. It removes small bright spots and tries to keep the remaining shapes.",
    "closing": "Closing dilates and then erodes. It fills small dark holes inside bright regions.",
    "resize": "Resizing rebuilds the pixel grid. Shrinking uses area interpolation. Enlarging uses linear interpolation.",
    "rotate": "Rotation warps the image around its center. The canvas grows so the corners stay inside the frame. New pixels are black.",
    "crop": "Cropping keeps one rectangle and discards the rest. Coordinates start at the top-left of the decoded image.",
    "flip": "Flipping mirrors the pixel grid horizontally, vertically, or both.",
}


def _validation_message(exc: ValidationError) -> str:
    parts = []
    for error in exc.errors():
        loc = ".".join(str(item) for item in error.get("loc", []))
        message = error.get("msg", "Invalid value")
        parts.append(f"{loc}: {message}" if loc else message)
    return "; ".join(parts) or "The parameters are invalid."


def run_operation(image: np.ndarray, operation: str, parameters: dict) -> dict:
    model = OPERATION_MODELS.get(operation)
    if model is None:
        supported = ", ".join(OPERATION_MODELS)
        raise InvalidParameters(f"Unsupported operation '{operation}'. Supported operations: {supported}.")
    try:
        params = model.model_validate(parameters)
    except ValidationError as exc:
        raise InvalidParameters(_validation_message(exc)) from exc
    output, extras = HANDLERS[operation](image, params)
    return {
        "operation": operation,
        "parameters": params.model_dump(),
        "image": output,
        "extras": {key: value for key, value in extras.items() if value is not None},
        "concept_note": CONCEPT_NOTES[operation],
    }


def _grayscale(image: np.ndarray, _params) -> tuple[np.ndarray, dict]:
    if image.ndim == 2:
        return image.copy(), {"already_grayscale": True}
    return as_gray(image), {"already_grayscale": False}


def _gaussian(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    blurred = cv2.GaussianBlur(
        image,
        (params.kernel_size, params.kernel_size),
        sigmaX=params.sigma,
        sigmaY=params.sigma,
    )
    note = "A sigma of 0 lets OpenCV derive sigma from the kernel size." if params.sigma == 0 else None
    return blurred, {"sigma_note": note}


def _threshold(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    gray = as_gray(image)
    prepared = "The color image was converted to grayscale before thresholding." if image.ndim == 3 else None
    if params.method == "global":
        _ok, binary = cv2.threshold(gray, params.threshold, params.max_value, cv2.THRESH_BINARY)
        return binary, {"method": "global", "preprocessed": prepared}
    height, width = gray.shape[:2]
    if params.block_size >= width or params.block_size >= height:
        raise InvalidParameters("block_size must be smaller than both image dimensions.")
    adaptive = (
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C
        if params.adaptive_method == "gaussian"
        else cv2.ADAPTIVE_THRESH_MEAN_C
    )
    binary = cv2.adaptiveThreshold(
        gray,
        params.max_value,
        adaptive,
        cv2.THRESH_BINARY,
        params.block_size,
        params.c,
    )
    return binary, {"method": "adaptive", "preprocessed": prepared}


def _canny(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    edges = cv2.Canny(
        as_gray(image),
        params.low_threshold,
        params.high_threshold,
        apertureSize=params.aperture_size,
    )
    prepared = "The color image was converted to grayscale before edge detection." if image.ndim == 3 else None
    return edges, {"preprocessed": prepared}


def _contours(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    gray = as_gray(image)
    if params.mode == "canny":
        working = cv2.Canny(gray, params.low_threshold, params.high_threshold)
    else:
        _ok, working = cv2.threshold(gray, params.threshold, 255, cv2.THRESH_BINARY)
    found, _hierarchy = cv2.findContours(working, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    records = []
    for contour in found:
        area = float(cv2.contourArea(contour))
        if area < params.min_area:
            continue
        x, y, width, height = cv2.boundingRect(contour)
        records.append(
            (
                area,
                contour,
                {
                    "area": round(area, 2),
                    "bbox": {
                        "x1": int(x),
                        "y1": int(y),
                        "x2": int(x + width),
                        "y2": int(y + height),
                    },
                },
            )
        )
    records.sort(key=lambda item: item[0], reverse=True)
    canvas = as_bgr(image).copy()
    for _area, contour, _meta in records[:30]:
        cv2.drawContours(canvas, [contour], -1, (94, 224, 181), 2)
        x, y, width, height = cv2.boundingRect(contour)
        cv2.rectangle(canvas, (x, y), (x + width, y + height), (240, 195, 181), 1)
    return canvas, {
        "contour_count": len(records),
        "contours": [item[2] for item in records[:30]],
        "display": "Outlines are drawn on a color canvas. The stored original image is unchanged.",
    }


def _kernel(params) -> np.ndarray:
    shape = cv2.MORPH_ELLIPSE if params.shape == "ellipse" else cv2.MORPH_RECT
    return cv2.getStructuringElement(shape, (params.kernel_size, params.kernel_size))


def _erosion(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    return cv2.erode(image, _kernel(params), iterations=params.iterations), {"shape": params.shape}


def _dilation(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    return cv2.dilate(image, _kernel(params), iterations=params.iterations), {"shape": params.shape}


def _opening(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    return cv2.morphologyEx(image, cv2.MORPH_OPEN, _kernel(params), iterations=params.iterations), {
        "shape": params.shape
    }


def _closing(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    return cv2.morphologyEx(image, cv2.MORPH_CLOSE, _kernel(params), iterations=params.iterations), {
        "shape": params.shape
    }


def _resize(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    height, width = image.shape[:2]
    if params.keep_aspect:
        if params.width and params.height:
            scale = min(params.width / width, params.height / height)
            new_width = max(1, int(round(width * scale)))
            new_height = max(1, int(round(height * scale)))
        elif params.width:
            scale = params.width / width
            new_width = params.width
            new_height = max(1, int(round(height * scale)))
        else:
            scale = params.height / height
            new_height = params.height
            new_width = max(1, int(round(width * scale)))
    else:
        if params.width is None or params.height is None:
            raise InvalidParameters("width and height are both required when keep_aspect is false.")
        new_width, new_height = params.width, params.height
    if new_width > 4096 or new_height > 4096:
        raise InvalidParameters("Resized dimensions cannot exceed 4096 pixels.")
    interpolation = cv2.INTER_AREA if new_width * new_height < width * height else cv2.INTER_LINEAR
    resized = cv2.resize(image, (new_width, new_height), interpolation=interpolation)
    return resized, {"width": new_width, "height": new_height}


def _rotate(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    height, width = image.shape[:2]
    center = (width / 2, height / 2)
    matrix = cv2.getRotationMatrix2D(center, params.angle, 1.0)
    cos = abs(matrix[0, 0])
    sin = abs(matrix[0, 1])
    new_width = max(1, int(round((height * sin) + (width * cos))))
    new_height = max(1, int(round((height * cos) + (width * sin))))
    matrix[0, 2] += (new_width / 2) - center[0]
    matrix[1, 2] += (new_height / 2) - center[1]
    if new_width > 4096 or new_height > 4096:
        raise InvalidParameters("Rotation would exceed the supported output size.")
    border = (0, 0, 0) if image.ndim == 3 else 0
    rotated = cv2.warpAffine(
        image,
        matrix,
        (new_width, new_height),
        flags=cv2.INTER_LINEAR,
        borderValue=border,
    )
    return rotated, {"width": new_width, "height": new_height}


def _crop(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    height, width = image.shape[:2]
    if params.x + params.width > width or params.y + params.height > height:
        raise InvalidParameters(f"The crop rectangle is outside the {width}×{height} image.")
    cropped = image[params.y : params.y + params.height, params.x : params.x + params.width].copy()
    return cropped, {"width": int(params.width), "height": int(params.height)}


def _flip(image: np.ndarray, params) -> tuple[np.ndarray, dict]:
    codes = {"horizontal": 1, "vertical": 0, "both": -1}
    return cv2.flip(image, codes[params.mode]), {"mode": params.mode}


HANDLERS = {
    "grayscale": _grayscale,
    "gaussian_blur": _gaussian,
    "threshold": _threshold,
    "canny": _canny,
    "contours": _contours,
    "erosion": _erosion,
    "dilation": _dilation,
    "opening": _opening,
    "closing": _closing,
    "resize": _resize,
    "rotate": _rotate,
    "crop": _crop,
    "flip": _flip,
}
