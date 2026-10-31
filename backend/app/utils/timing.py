import time


def elapsed_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 2)


def make_timing(
    processing_ms: float,
    inference_ms: float | None = None,
    load_ms: float | None = None,
    scope: str = "not_applicable",
) -> dict:
    if scope == "measured" and inference_ms is None:
        scope = "unavailable"
    return {
        "processing_time_ms": round(processing_ms, 2),
        "inference_time_ms": None if inference_ms is None else round(inference_ms, 2),
        "model_load_time_ms": None if load_ms is None else round(load_ms, 2),
        "inference_scope": scope,
    }
