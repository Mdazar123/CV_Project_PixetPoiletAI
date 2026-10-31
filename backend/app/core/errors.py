class PixelPilotError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class UnsupportedImage(PixelPilotError):
    def __init__(self, message: str) -> None:
        super().__init__("UNSUPPORTED_IMAGE", message, 400)


class FileTooLarge(PixelPilotError):
    def __init__(self, message: str) -> None:
        super().__init__("FILE_TOO_LARGE", message, 413)


class ImageTooLarge(PixelPilotError):
    def __init__(self, message: str) -> None:
        super().__init__("IMAGE_TOO_LARGE", message, 400)


class ImageDecodeError(PixelPilotError):
    def __init__(self, message: str = "The file could not be decoded as an image.") -> None:
        super().__init__("IMAGE_DECODE_FAILED", message, 400)


class ImageNotFound(PixelPilotError):
    def __init__(self, message: str = "That image is no longer available. Upload it again.") -> None:
        super().__init__("IMAGE_NOT_FOUND", message, 404)


class InvalidParameters(PixelPilotError):
    def __init__(self, message: str) -> None:
        super().__init__("INVALID_PARAMETERS", message, 422)


class ModelUnavailable(PixelPilotError):
    def __init__(self, message: str) -> None:
        super().__init__("MODEL_UNAVAILABLE", message, 503)


class ProviderTimeout(PixelPilotError):
    def __init__(self, message: str) -> None:
        super().__init__("PROVIDER_TIMEOUT", message, 504)


class ProviderRateLimited(PixelPilotError):
    def __init__(self, message: str) -> None:
        super().__init__("PROVIDER_RATE_LIMIT", message, 429)


class InferenceFailure(PixelPilotError):
    def __init__(self, message: str) -> None:
        super().__init__("INFERENCE_FAILURE", message, 500)
