import os

from app.core.config import settings
from app.core.native_libs import prepare_graphics_libraries


def test_graphics_library_setup_does_not_restart_windows_or_tests():
    before = os.environ.get("LD_LIBRARY_PATH")
    prepare_graphics_libraries()
    assert os.environ.get("LD_LIBRARY_PATH") == before


def test_low_memory_tightens_image_and_store_limits(monkeypatch):
    monkeypatch.setattr(settings, "low_memory", False)
    assert settings.image_side_limit == settings.max_image_side
    assert settings.stored_image_limit == settings.max_stored_images

    monkeypatch.setattr(settings, "low_memory", True)
    assert settings.image_side_limit == settings.low_memory_image_side
    assert settings.pixel_limit == settings.low_memory_pixels
    assert settings.stored_image_limit == settings.low_memory_stored_images


def test_low_memory_releases_the_other_models(monkeypatch):
    from app.core import model_slots

    released = []
    monkeypatch.setitem(model_slots._releasers, "detector", lambda: released.append("detector"))
    monkeypatch.setitem(model_slots._releasers, "ocr", lambda: released.append("ocr"))
    model_slots.release_others("ocr")
    assert "detector" in released and "ocr" not in released
