"""Prepare the process before any vision library is imported."""

import os
import sys
from pathlib import Path

LIB_DIR = Path(__file__).resolve().parents[2] / "vendor" / "libs"
THREAD_VARS = ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS")


def limit_thread_pools() -> None:
    """Size native thread pools for the CPU share we have, not the host's cores.

    Render's small instances report every host core, so OpenCV, XNNPACK, and
    ONNX Runtime would each allocate per-thread buffers they can never use.
    """
    from app.core.config import settings

    if not settings.low_memory:
        return
    for name in THREAD_VARS:
        os.environ.setdefault(name, "1")


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
