from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmptyParams(StrictModel):
    pass


class GaussianParams(StrictModel):
    kernel_size: int = 5
    sigma: float = 0

    @field_validator("kernel_size")
    @classmethod
    def odd_kernel(cls, value: int) -> int:
        if value < 1 or value > 31 or value % 2 == 0:
            raise ValueError("must be an odd integer from 1 to 31")
        return value

    @field_validator("sigma")
    @classmethod
    def sigma_range(cls, value: float) -> float:
        if value < 0 or value > 25:
            raise ValueError("must be between 0 and 25")
        return value


class ThresholdParams(StrictModel):
    method: Literal["global", "adaptive"] = "global"
    threshold: int = 127
    max_value: int = 255
    adaptive_method: Literal["mean", "gaussian"] = "gaussian"
    block_size: int = 11
    c: int = 2

    @field_validator("threshold", "max_value")
    @classmethod
    def byte_range(cls, value: int) -> int:
        if not 0 <= value <= 255:
            raise ValueError("must be between 0 and 255")
        return value

    @field_validator("block_size")
    @classmethod
    def odd_block(cls, value: int) -> int:
        if value < 3 or value > 99 or value % 2 == 0:
            raise ValueError("must be an odd integer from 3 to 99")
        return value


class CannyParams(StrictModel):
    low_threshold: int = 80
    high_threshold: int = 160
    aperture_size: Literal[3, 5, 7] = 3

    @model_validator(mode="after")
    def threshold_order(self) -> "CannyParams":
        if not 0 <= self.low_threshold <= 500 or not 0 <= self.high_threshold <= 500:
            raise ValueError("thresholds must be between 0 and 500")
        if self.low_threshold >= self.high_threshold:
            raise ValueError("low_threshold must be lower than high_threshold")
        return self


class ContourParams(StrictModel):
    mode: Literal["threshold", "canny"] = "threshold"
    threshold: int = 127
    low_threshold: int = 80
    high_threshold: int = 160
    min_area: float = 10

    @field_validator("threshold")
    @classmethod
    def threshold_range(cls, value: int) -> int:
        if not 0 <= value <= 255:
            raise ValueError("must be between 0 and 255")
        return value

    @field_validator("min_area")
    @classmethod
    def area_range(cls, value: float) -> float:
        if value < 0 or value > 1_000_000:
            raise ValueError("must be between 0 and 1000000")
        return value

    @model_validator(mode="after")
    def canny_order(self) -> "ContourParams":
        if not 0 <= self.low_threshold <= 500 or not 0 <= self.high_threshold <= 500:
            raise ValueError("Canny thresholds must be between 0 and 500")
        if self.mode == "canny" and self.low_threshold >= self.high_threshold:
            raise ValueError("low_threshold must be lower than high_threshold")
        return self


class MorphParams(StrictModel):
    kernel_size: int = 3
    iterations: int = 1
    shape: Literal["rect", "ellipse"] = "rect"

    @field_validator("kernel_size")
    @classmethod
    def odd_kernel(cls, value: int) -> int:
        if value < 1 or value > 31 or value % 2 == 0:
            raise ValueError("must be an odd integer from 1 to 31")
        return value

    @field_validator("iterations")
    @classmethod
    def iteration_range(cls, value: int) -> int:
        if value < 1 or value > 10:
            raise ValueError("must be between 1 and 10")
        return value


class ResizeParams(StrictModel):
    width: int | None = None
    height: int | None = None
    keep_aspect: bool = True

    @model_validator(mode="after")
    def has_dimension(self) -> "ResizeParams":
        if self.width is None and self.height is None:
            raise ValueError("width or height is required")
        for name, value in (("width", self.width), ("height", self.height)):
            if value is not None and (value < 1 or value > 4096):
                raise ValueError(f"{name} must be between 1 and 4096")
        return self


class RotateParams(StrictModel):
    angle: float = 90

    @field_validator("angle")
    @classmethod
    def angle_range(cls, value: float) -> float:
        if value < -360 or value > 360:
            raise ValueError("must be between -360 and 360")
        return value


class CropParams(StrictModel):
    x: int
    y: int
    width: int
    height: int

    @model_validator(mode="after")
    def bounds(self) -> "CropParams":
        if self.x < 0 or self.y < 0:
            raise ValueError("x and y must be zero or positive")
        if self.width < 1 or self.height < 1:
            raise ValueError("width and height must be at least 1")
        if self.width > 4096 or self.height > 4096:
            raise ValueError("crop dimensions cannot exceed 4096")
        return self


class FlipParams(StrictModel):
    mode: Literal["horizontal", "vertical", "both"] = "horizontal"


class GrabCutParams(StrictModel):
    x: int | None = None
    y: int | None = None
    width: int | None = None
    height: int | None = None
    iterations: int = 5

    @field_validator("iterations")
    @classmethod
    def iteration_range(cls, value: int) -> int:
        if value < 1 or value > 5:
            raise ValueError("must be between 1 and 5")
        return value


class DeepLabParams(StrictModel):
    pass


class PixelQuery(StrictModel):
    x: int
    y: int
    width: int = 1
    height: int = 1


class ReportRequest(StrictModel):
    image_id: str = Field(pattern=r"^img_[a-f0-9]{16}$")
    include_classical: bool = False
    include_detection: bool = False
    include_segmentation: bool = False
    include_ocr: bool = False
    include_similarity: bool = False
    include_vlm: bool = False
    use_llm: bool = False
    user_observation: str | None = Field(default=None, max_length=500)

    @field_validator("user_observation")
    @classmethod
    def blank_observation(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


OPERATION_MODELS: dict[str, type[BaseModel]] = {
    "grayscale": EmptyParams,
    "gaussian_blur": GaussianParams,
    "threshold": ThresholdParams,
    "canny": CannyParams,
    "contours": ContourParams,
    "erosion": MorphParams,
    "dilation": MorphParams,
    "opening": MorphParams,
    "closing": MorphParams,
    "resize": ResizeParams,
    "rotate": RotateParams,
    "crop": CropParams,
    "flip": FlipParams,
}
