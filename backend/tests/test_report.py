import numpy as np
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.store import store
from app.main import app


def test_report_uses_stored_results_only(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    store.clear()
    client = TestClient(app)
    image = np.zeros((30, 40, 3), np.uint8)
    import cv2

    ok, buffer = cv2.imencode(".png", image)
    assert ok
    uploaded = client.post(
        "/api/v1/images/inspect",
        files={"file": ("sample.png", buffer.tobytes(), "image/png")},
    )
    image_id = uploaded.json()["image_id"]
    processed = client.post(
        "/api/v1/cv/preprocess",
        data={"image_id": image_id, "operation": "grayscale", "parameters": "{}"},
    )
    assert processed.status_code == 200

    invented = client.post(
        "/api/v1/ai/report",
        json={"image_id": image_id, "include_classical": True, "detections": [{"label": "bottle"}]},
    )
    assert invented.status_code == 422
    assert invented.json()["error"]["code"] == "INVALID_REQUEST"

    report = client.post(
        "/api/v1/ai/report",
        json={
            "image_id": image_id,
            "include_classical": True,
            "include_detection": True,
            "use_llm": True,
            "user_observation": "The edge looks broken.",
        },
    )
    assert report.status_code == 200
    body = report.json()
    observations = " ".join(body["report"]["observations"]).lower()
    limitations = " ".join(body["report"]["limitations"]).lower()
    assert "grayscale" in observations
    assert "bottle" not in observations
    assert "not run" in limitations
    assert body["report"]["user_observation"] == "The edge looks broken."
    assert "broken" not in observations
    assert body["llm_narrative"] is None
    assert body["llm_status"] == "not_configured"
    assert body["model"] == "grounded-report-v1"
    store.clear()
    assert settings.app_name
