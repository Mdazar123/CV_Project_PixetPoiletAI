# PixelPilot AI

PixelPilot AI is an image-understanding workbench. Upload one image, run classical OpenCV operations, inspect a pretrained detector and a semantic segmentation model, extract text, and build a report from the results that were actually stored.

The report does not invent detections. Vision-language answers are optional, labeled as interpretations, and are omitted when no provider is configured.

## What works in this version

- Image upload for JPEG, PNG, and WebP, with extension and file-content checks, size limits, and EXIF orientation applied before analysis.
- Metadata and a pixel readout. Color images are stored as BGR and the readout also shows RGB.
- Classical operations: grayscale, Gaussian blur, global and adaptive threshold, Canny, contours, erosion, dilation, opening, closing, resize, rotate, crop, and flip. The stored original is left unchanged.
- Object detection with MediaPipe EfficientDet Lite0. Boxes use absolute pixels. `x2` and `y2` are exclusive edges.
- GrabCut foreground segmentation, plus DeepLabV3 semantic segmentation on Pascal VOC classes when its model file is present.
- OCR through RapidOCR, including a valid empty result when no text is found.
- A grounded report assembled from analyses stored for the current image.
- Server processing time on every operation. Model calls also report inference time, and model-load time when the model is loaded on that request.
- Optional image-text similarity and optional OpenAI-compatible vision questions and report narratives.

## What this version does not claim

- Precision, recall, F1, IoU, and mAP are not measured here. No labeled evaluation set is included.
- EfficientDet Lite0 is a small CPU model. It misses small objects and can return no boxes.
- DeepLabV3 labels pixels with the Pascal VOC set. It does not separate instances of the same class.
- GrabCut is a classical foreground tool. The rectangle is part of the input.
- Similarity scores are cosine similarities, not probabilities. That path stays unavailable until the optional PyTorch package is installed.
- Vision and report narratives are unavailable until `OPENAI_API_KEY` is set. The API returns an error for a vision question instead of writing a fake answer.
- Uploaded images live in the API process memory and expire. Run one Uvicorn worker so image ids stay valid.
- This is not a medical, forensic, or safety-critical tool.

## Architecture

The Next.js app is the workspace. FastAPI validates uploads, runs vision services, and returns structured JSON. Routes stay separate from OpenCV and model code.

```text
frontend/    Next.js workspace
backend/
  app/api/routes/     HTTP endpoints
  app/services/       classical CV, detection, segmentation, OCR, VLM, reports
  app/core/           settings, errors, in-memory image store
  models/             EfficientDet and DeepLab files, downloaded locally
```

Model services:

| Task | Implementation |
| --- | --- |
| Classical CV | OpenCV |
| Detection | MediaPipe EfficientDet Lite0 int8 |
| Semantic segmentation | MediaPipe DeepLabV3 |
| Foreground segmentation | OpenCV GrabCut |
| OCR | RapidOCR ONNX Runtime |
| Similarity | OpenCLIP ViT-B-32, optional |
| Vision questions and narratives | OpenAI-compatible chat API, optional |

MediaPipe and RapidOCR weights are covered by their upstream licenses. Review those licenses, and the terms of any external model provider, before redistributing weights or sending images outside the machine.

## Setup

Use Python 3.12 and Node 22. From the repository root in PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts\download_models.py
.\.venv\Scripts\python.exe scripts\make_samples.py
copy .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

In a second terminal:

```powershell
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. The API docs are at http://localhost:8000/docs.

To enable image-text similarity:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-optional.txt
```

To enable vision questions and language-model narratives, set `OPENAI_API_KEY` in `backend/.env`. `OPENAI_BASE_URL`, `VLM_MODEL`, and `LLM_MODEL` can point at any OpenAI-compatible endpoint. Leave the key empty to keep those actions unavailable.

## API

All routes are under `/api/v1`.

- `GET /health`
- `GET /capabilities`
- `POST /images/inspect`
- `POST /images/{image_id}/pixels`
- `DELETE /images/{image_id}`
- `POST /cv/preprocess`
- `POST /cv/detect`
- `POST /cv/segment`
- `POST /cv/ocr`
- `POST /cv/similarity`
- `POST /ai/vision-question`
- `POST /ai/report`

Errors use `{ "error": { "code", "message", "request_id" } }`.

## Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

The tests cover upload rejection, pixel order, classical operations, original-image preservation, GrabCut, grounded reports, and the detector and DeepLab contracts when the model files are present. They also check that a missing detector or an unconfigured vision provider returns an error and does not include invented predictions.

## Project layout

The interface is one workspace: upload and mode navigation on the left, the image and controls in the center, and metadata, records, and timing on the right. Keys `1` through `9` switch modes when focus is outside a form field.
