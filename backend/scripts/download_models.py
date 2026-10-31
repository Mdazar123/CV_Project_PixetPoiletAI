import sys
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"
MODELS = {
    "efficientdet_lite0.tflite": "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite",
    "deeplab_v3.tflite": "https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite",
}


def download(name: str, url: str) -> None:
    destination = MODEL_DIR / name
    if destination.exists() and destination.stat().st_size > 100_000:
        print(f"present {destination}")
        return
    print(f"download {name}")
    with urlopen(url, timeout=120) as response:
        payload = response.read()
    if len(payload) < 100_000:
        raise SystemExit(f"{name} download was too small to be a model file.")
    destination.write_bytes(payload)
    print(f"saved {destination} ({len(payload)} bytes)")


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in MODELS.items():
        download(name, url)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"download failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
