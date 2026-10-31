import base64

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.store import store
from app.main import app
from app.services.detection import clip_bbox


@pytest.fixture(autouse=True)
def clean_store():
    store.clear()
    yield
    store.clear()


@pytest.fixture
def client():
    return TestClient(app)


def png_bytes(image: np.ndarray) -> bytes:
    ok, buffer = cv2.imencode(".png", image)
    assert ok
    return buffer.tobytes()


def upload(client: TestClient, image: np.ndarray, name: str = "sample.png"):
    return client.post(
        "/api/v1/images/inspect",
        files={"file": (name, png_bytes(image), "image/png")},
    )


def decode_result(payload: dict, key: str = "image_base64") -> np.ndarray:
    raw = base64.b64decode(payload[key])
    array = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_UNCHANGED)
    assert array is not None
    return array


def test_health_hides_configuration(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "pixelpilot-api"
    serialized = response.text.lower()
    assert "api_key" not in serialized
    assert "openai" not in serialized
    assert response.headers["X-Request-ID"]


def test_rejects_text_file_and_corrupt_png(client):
    text = client.post(
        "/api/v1/images/inspect",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert text.status_code == 400
    assert text.json()["error"]["code"] == "UNSUPPORTED_IMAGE"

    corrupt = client.post(
        "/api/v1/images/inspect",
        files={"file": ("broken.png", b"\x89PNG\r\n\x1a\nnot-an-image", "image/png")},
    )
    assert corrupt.status_code == 400
    assert corrupt.json()["error"]["code"] == "IMAGE_DECODE_FAILED"
    assert "traceback" not in corrupt.text.lower()


def test_rejects_extension_mismatch_and_oversize(client, monkeypatch):
    image = np.full((16, 16, 3), (10, 20, 30), np.uint8)
    mismatch = client.post(
        "/api/v1/images/inspect",
        files={"file": ("photo.jpg", png_bytes(image), "image/png")},
    )
    assert mismatch.status_code == 400
    assert mismatch.json()["error"]["code"] == "UNSUPPORTED_IMAGE"

    monkeypatch.setattr(settings, "max_upload_bytes", 40)
    oversized = upload(client, np.zeros((32, 32, 3), np.uint8))
    assert oversized.status_code == 413
    assert oversized.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_inspect_reports_bgr_pixel(client):
    image = np.full((12, 10, 3), (10, 20, 30), np.uint8)
    response = upload(client, image)
    assert response.status_code == 200
    body = response.json()
    assert body["width"] == 10
    assert body["height"] == 12
    assert body["channels"] == 3
    assert body["color_space"] == "BGR"
    assert body["format"] == "PNG"
    pixels = client.post(f"/api/v1/images/{body['image_id']}/pixels", json={"x": 1, "y": 2})
    assert pixels.status_code == 200
    point = pixels.json()["pixels"][0]
    assert point["bgr"] == [10, 20, 30]
    assert point["rgb"] == [30, 20, 10]


def test_preprocess_preserves_original_and_changes_output(client):
    image = np.zeros((40, 50, 3), np.uint8)
    image[:, :10] = (0, 0, 255)
    uploaded = upload(client, image).json()
    image_id = uploaded["image_id"]
    before = client.post(f"/api/v1/images/{image_id}/pixels", json={"x": 0, "y": 0}).json()
    blurred = client.post(
        "/api/v1/cv/preprocess",
        data={"image_id": image_id, "operation": "gaussian_blur", "parameters": '{"kernel_size": 5, "sigma": 1}'},
    )
    assert blurred.status_code == 200
    body = blurred.json()
    assert body["channels"] == 3
    assert body["timing"]["inference_scope"] == "not_applicable"
    assert body["timing"]["inference_time_ms"] is None
    output = decode_result(body)
    assert output.shape[1] == 50
    after = client.post(f"/api/v1/images/{image_id}/pixels", json={"x": 0, "y": 0}).json()
    assert after["pixels"] == before["pixels"]
    # Column 10 sits on the red/black boundary, so a 5-pixel kernel must mix it.
    assert int(output[20, 10].sum()) > 0
    assert not np.array_equal(output[20, 10], np.array([0, 0, 0]))


def test_classical_operations_and_validation(client):
    image = np.zeros((80, 100), np.uint8)
    cv2.rectangle(image, (15, 10), (70, 60), 255, -1)
    image_id = upload(client, image).json()["image_id"]

    gray = client.post(
        "/api/v1/cv/preprocess",
        data={"image_id": image_id, "operation": "grayscale", "parameters": "{}"},
    )
    assert gray.status_code == 200
    assert gray.json()["channels"] == 1

    edges = client.post(
        "/api/v1/cv/preprocess",
        data={
            "image_id": image_id,
            "operation": "canny",
            "parameters": '{"low_threshold": 40, "high_threshold": 120}',
        },
    )
    assert edges.status_code == 200
    assert edges.json()["channels"] == 1

    binary = client.post(
        "/api/v1/cv/preprocess",
        data={"image_id": image_id, "operation": "threshold", "parameters": '{"method": "global", "threshold": 127}'},
    )
    assert binary.status_code == 200
    values = set(np.unique(decode_result(binary.json())).tolist())
    assert values <= {0, 255}

    contours = client.post(
        "/api/v1/cv/preprocess",
        data={"image_id": image_id, "operation": "contours", "parameters": '{"min_area": 10}'},
    )
    assert contours.status_code == 200
    assert contours.json()["extras"]["contour_count"] >= 1

    cropped = client.post(
        "/api/v1/cv/preprocess",
        data={"image_id": image_id, "operation": "crop", "parameters": '{"x": 5, "y": 5, "width": 20, "height": 15}'},
    )
    assert cropped.status_code == 200
    assert cropped.json()["width"] == 20
    assert cropped.json()["height"] == 15

    even = client.post(
        "/api/v1/cv/preprocess",
        data={"image_id": image_id, "operation": "gaussian_blur", "parameters": '{"kernel_size": 4}'},
    )
    assert even.status_code == 422
    assert even.json()["error"]["code"] == "INVALID_PARAMETERS"

    unknown = client.post(
        "/api/v1/cv/preprocess",
        data={"image_id": image_id, "operation": "cartoon", "parameters": "{}"},
    )
    assert unknown.status_code == 422
    assert "image_base64" not in unknown.json()

    extra = client.post(
        "/api/v1/cv/preprocess",
        data={"image_id": image_id, "operation": "grayscale", "parameters": '{"kernel_size": 3}'},
    )
    assert extra.status_code == 422


def test_flip_moves_pixels(client):
    image = np.zeros((20, 30), np.uint8)
    image[:, 0] = 255
    image_id = upload(client, image).json()["image_id"]
    response = client.post(
        "/api/v1/cv/preprocess",
        data={"image_id": image_id, "operation": "flip", "parameters": '{"mode": "horizontal"}'},
    )
    output = decode_result(response.json())
    assert int(output[0, 0]) == 0
    assert int(output[0, -1]) == 255


def test_missing_image_reference(client):
    response = client.post(
        "/api/v1/cv/preprocess",
        data={"operation": "grayscale", "parameters": "{}"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_PARAMETERS"
    missing = client.delete("/api/v1/images/img_0123456789abcdef")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "IMAGE_NOT_FOUND"


def test_clip_bbox_contract():
    assert clip_bbox(-5, 10, 50, 400, 100, 80) == {"x1": 0, "y1": 10, "x2": 50, "y2": 80}
    assert clip_bbox(-10, -10, 0, 0, 100, 100) is None


def test_detection_missing_model_does_not_invent_boxes(client, monkeypatch):
    monkeypatch.setattr(settings, "detector_filename", "does-not-exist.tflite")
    image_id = upload(client, np.zeros((32, 32, 3), np.uint8)).json()["image_id"]
    response = client.post("/api/v1/cv/detect", data={"image_id": image_id, "confidence": "0.25"})
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "MODEL_UNAVAILABLE"
    assert "detections" not in body


def test_grabcut_returns_a_mask(client):
    image = np.zeros((160, 160, 3), np.uint8)
    cv2.rectangle(image, (48, 48), (112, 120), (255, 255, 255), -1)
    image_id = upload(client, image).json()["image_id"]
    response = client.post(
        "/api/v1/cv/segment",
        data={
            "image_id": image_id,
            "method": "grabcut",
            "parameters": '{"x": 40, "y": 40, "width": 80, "height": 90, "iterations": 3}',
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "opencv-grabcut"
    assert body["task"] == "classical-foreground"
    mask = decode_result(body, "mask_base64")
    assert mask.shape[0] == 160
    assert any(item["label"] == "foreground" and item["pixel_count"] > 0 for item in body["classes"])


def test_similarity_and_vlm_fail_closed(client, monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    image_id = upload(client, np.full((24, 24, 3), 80, np.uint8)).json()["image_id"]
    vision = client.post(
        "/api/v1/ai/vision-question",
        data={"image_id": image_id, "question": "What is visible?"},
    )
    assert vision.status_code == 503
    assert vision.json()["error"]["code"] == "MODEL_UNAVAILABLE"
    assert "answer" not in vision.json()

    similarity = client.post(
        "/api/v1/cv/similarity",
        data={"image_id": image_id, "candidates": '["a desk", "a bicycle"]'},
    )
    if similarity.status_code == 503:
        assert similarity.json()["error"]["code"] == "MODEL_UNAVAILABLE"
        assert "rankings" not in similarity.json()
    else:
        assert similarity.status_code == 200
        assert similarity.json()["score_type"] == "cosine_similarity"


def test_pretrained_models_when_files_exist(client):
    image = np.full((240, 320, 3), (180, 170, 160), np.uint8)
    cv2.circle(image, (160, 120), 50, (40, 40, 200), -1)
    image_id = upload(client, image).json()["image_id"]
    if settings.detector_path.exists():
        detected = client.post("/api/v1/cv/detect", data={"image_id": image_id, "confidence": "0.25", "max_results": "10"})
        assert detected.status_code == 200
        body = detected.json()
        assert body["task"] == "object-detection"
        assert body["coordinate_system"] == "absolute_pixels"
        assert body["timing"]["inference_scope"] == "measured"
        assert body["timing"]["inference_time_ms"] >= 0
        for item in body["detections"]:
            box = item["bbox"]
            assert 0 <= box["x1"] < box["x2"] <= body["image_width"]
            assert 0 <= box["y1"] < box["y2"] <= body["image_height"]
            assert 0 <= item["confidence"] <= 1
            assert item["label"]
    if settings.segmenter_path.exists():
        segmented = client.post("/api/v1/cv/segment", data={"image_id": image_id, "method": "deeplab", "parameters": "{}"})
        assert segmented.status_code == 200
        body = segmented.json()
        assert body["task"] == "semantic-segmentation"
        assert body["model"] == "mediapipe-deeplab-v3"
        assert decode_result(body, "mask_base64").shape[0] == 240
        assert any(item["label"] == "background" for item in body["classes"])


def test_ocr_contract(client):
    image = np.full((80, 180, 3), 255, np.uint8)
    cv2.putText(image, "HI", (20, 55), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 0, 0), 2)
    image_id = upload(client, image).json()["image_id"]
    response = client.post("/api/v1/cv/ocr", data={"image_id": image_id})
    if response.status_code == 503:
        assert response.json()["error"]["code"] == "MODEL_UNAVAILABLE"
        return
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["text_regions"], list)
    assert body["region_count"] == len(body["text_regions"])
    assert "language model" not in body["note"].lower() or "separate" in body["note"].lower()
