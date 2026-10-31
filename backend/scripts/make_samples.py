from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "samples"


def geometry() -> None:
    gradient = np.tile(np.linspace(24, 214, 960, dtype=np.uint8), (640, 1))
    image = cv2.merge([gradient, gradient, gradient])
    cv2.rectangle(image, (70, 80), (390, 430), (70, 170, 60), -1)
    cv2.circle(image, (690, 280), 150, (40, 70, 190), -1)
    cv2.rectangle(image, (430, 390), (620, 560), (230, 230, 230), 3)
    cv2.line(image, (40, 590), (920, 40), (250, 250, 250), 2)
    rng = np.random.default_rng(4)
    image[36:92, 790:846] = rng.integers(0, 255, (56, 56, 3), dtype=np.uint8)
    OUT.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUT / "lab-geometry.png"), image)


def text_card() -> None:
    canvas = Image.new("RGB", (960, 480), (244, 241, 232))
    draw = ImageDraw.Draw(canvas)
    try:
        title = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 84)
        body = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 42)
    except OSError:
        title = ImageFont.load_default()
        body = title
    draw.text((70, 70), "INVOICE 204", fill=(20, 24, 28), font=title)
    draw.text((70, 190), "TOTAL 18", fill=(20, 24, 28), font=body)
    draw.text((70, 270), "PixelPilot sample", fill=(40, 70, 80), font=body)
    for index, width in enumerate([8, 3, 14, 5, 9, 2, 12, 6, 4, 11]):
        x = 70 + index * 28
        draw.rectangle((x, 360, x + width, 430), fill=(20, 24, 28))
    canvas.save(OUT / "lab-text.png")


if __name__ == "__main__":
    geometry()
    text_card()
    print(f"samples written to {OUT}")
