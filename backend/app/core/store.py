from dataclasses import dataclass, field
import threading
import time
import uuid

import numpy as np

from app.core.config import settings


@dataclass
class ImageRecord:
    image_id: str
    image: np.ndarray
    file_format: str
    file_size_bytes: int
    color_space: str
    alpha_discarded: bool
    created_at: float
    analyses: dict = field(default_factory=dict)


class ImageStore:
    def __init__(self) -> None:
        self._items: dict[str, ImageRecord] = {}
        self._lock = threading.Lock()

    def put(
        self,
        image: np.ndarray,
        file_format: str,
        file_size_bytes: int,
        color_space: str,
        alpha_discarded: bool,
    ) -> ImageRecord:
        record = ImageRecord(
            image_id=f"img_{uuid.uuid4().hex[:16]}",
            image=np.ascontiguousarray(image),
            file_format=file_format,
            file_size_bytes=file_size_bytes,
            color_space=color_space,
            alpha_discarded=alpha_discarded,
            created_at=time.time(),
        )
        with self._lock:
            self._purge_locked(time.time())
            overflow = len(self._items) + 1 - settings.stored_image_limit
            if overflow > 0:
                ordered = sorted(self._items.values(), key=lambda item: item.created_at)
                for stale in ordered[:overflow]:
                    self._items.pop(stale.image_id, None)
            self._items[record.image_id] = record
        return record

    def get(self, image_id: str) -> ImageRecord | None:
        with self._lock:
            record = self._items.get(image_id)
            if record is None:
                return None
            if time.time() - record.created_at > settings.image_ttl_seconds:
                self._items.pop(image_id, None)
                return None
            return record

    def delete(self, image_id: str) -> bool:
        with self._lock:
            return self._items.pop(image_id, None) is not None

    def clear(self) -> None:
        with self._lock:
            self._items.clear()

    def set_analysis(self, image_id: str, key: str, value: dict) -> None:
        with self._lock:
            record = self._items.get(image_id)
            if record is None:
                return
            if key == "classical":
                history = list(record.analyses.get("classical", []))
                history.append(value)
                record.analyses["classical"] = history[-8:]
            else:
                record.analyses[key] = value

    def _purge_locked(self, now: float) -> None:
        expired = [
            image_id
            for image_id, record in self._items.items()
            if now - record.created_at > settings.image_ttl_seconds
        ]
        for image_id in expired:
            self._items.pop(image_id, None)


store = ImageStore()
