"""Make MediaPipe's Linux graphics libraries visible before the model loads."""

import os
import sys
from pathlib import Path

LIB_DIR = Path(__file__).resolve().parents[2] / "vendor" / "libs"


def prepare_graphics_libraries() -> None:
    if sys.platform != "linux" or "pytest" in sys.modules:
        return
    entry = str(LIB_DIR)
    if not (LIB_DIR / "libEGL.so.1").is_file() or not (LIB_DIR / "libGLESv2.so.2").is_file():
        return
    current = [item for item in os.environ.get("LD_LIBRARY_PATH", "").split(":") if item]
    if entry in current:
        return
    os.environ["LD_LIBRARY_PATH"] = ":".join([entry, *current])
    print(f"restarting with graphics libraries from {entry}", flush=True)
    os.execv(sys.executable, [sys.executable, *sys.argv])
