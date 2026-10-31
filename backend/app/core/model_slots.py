"""Keep one heavy model resident at a time on small deployments.

The detector, the segmenter, and the OCR engine each hold tens of megabytes of
runtime buffers. A 512 MB host cannot keep all three, so each service releases
the others before it loads.
"""

import logging
import threading
from collections.abc import Callable

logger = logging.getLogger("pixelpilot.models")

_releasers: dict[str, Callable[[], None]] = {}
_lock = threading.Lock()


def register(name: str, release: Callable[[], None]) -> None:
    with _lock:
        _releasers[name] = release


def release_others(name: str) -> None:
    with _lock:
        others = [(key, release) for key, release in _releasers.items() if key != name]
    for key, release in others:
        try:
            release()
        except Exception:
            logger.warning("releasing %s failed", key, exc_info=True)
