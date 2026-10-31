import os
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODEL_DIR = BACKEND_DIR / "models"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "pixelpilot-api"
    version: str = "1.0.0"
    max_upload_bytes: int = 10 * 1024 * 1024
    max_image_side: int = 4096
    max_pixels: int = 16_000_000
    cors_origins: str = "http://localhost:3000"
    image_ttl_seconds: int = 1800
    max_stored_images: int = 8
    device: str = "cpu"
    detector_filename: str = "efficientdet_lite0.tflite"
    segmenter_filename: str = "deeplab_v3.tflite"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    vlm_model: str = "gpt-4o-mini"
    llm_model: str = "gpt-4o-mini"
    provider_timeout_seconds: float = 60.0
    low_memory: bool = Field(default_factory=lambda: bool(os.environ.get("RENDER")))
    low_memory_image_side: int = 2048
    low_memory_pixels: int = 4_000_000
    low_memory_stored_images: int = 3

    @property
    def image_side_limit(self) -> int:
        return min(self.max_image_side, self.low_memory_image_side) if self.low_memory else self.max_image_side

    @property
    def pixel_limit(self) -> int:
        return min(self.max_pixels, self.low_memory_pixels) if self.low_memory else self.max_pixels

    @property
    def stored_image_limit(self) -> int:
        return min(self.max_stored_images, self.low_memory_stored_images) if self.low_memory else self.max_stored_images

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def detector_path(self) -> Path:
        return MODEL_DIR / self.detector_filename

    @property
    def segmenter_path(self) -> Path:
        return MODEL_DIR / self.segmenter_filename


settings = Settings()
