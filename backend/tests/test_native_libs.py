import os

from app.core.native_libs import prepare_graphics_libraries


def test_graphics_library_setup_does_not_restart_windows_or_tests():
    before = os.environ.get("LD_LIBRARY_PATH")
    prepare_graphics_libraries()
    assert os.environ.get("LD_LIBRARY_PATH") == before
