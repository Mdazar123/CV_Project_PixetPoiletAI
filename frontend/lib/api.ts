import type {
  Capabilities,
  DetectionResult,
  ImageMetadata,
  OcrResult,
  PixelReadout,
  ProcessResult,
  ReportResult,
  SegmentResult,
  SimilarityResult,
  VisionResult,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  code: string;
  requestId?: string;

  constructor(code: string, message: string, requestId?: string) {
    super(message);
    this.code = code;
    this.requestId = requestId;
  }
}

async function parse<T>(response: Response): Promise<T> {
  const headerId = response.headers.get("X-Request-ID") ?? undefined;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error;
    throw new ApiError(
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "The request failed.",
      error?.request_id ?? headerId,
    );
  }
  return body as T;
}

async function send(path: string, init?: RequestInit) {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError("NETWORK", "The backend is not reachable. Start the API and try again.");
  }
}

export function dataUrl(mediaType: string, base64: string) {
  return `data:${mediaType};base64,${base64}`;
}

export async function getHealth() {
  const response = await send("/api/v1/health");
  return parse<{ status: string; service: string; version: string }>(response);
}

export async function getCapabilities() {
  const response = await send("/api/v1/capabilities");
  return parse<Capabilities>(response);
}

export async function inspectImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  return parse<ImageMetadata>(await send("/api/v1/images/inspect", { method: "POST", body: form }));
}

export async function deleteImage(imageId: string) {
  await parse(await send(`/api/v1/images/${imageId}`, { method: "DELETE" }));
}

export async function readPixels(imageId: string, x: number, y: number) {
  return parse<PixelReadout>(
    await send(`/api/v1/images/${imageId}/pixels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y, width: 1, height: 1 }),
    }),
  );
}

function form(fields: Record<string, string>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return body;
}

export async function preprocess(imageId: string, operation: string, parameters: Record<string, unknown>) {
  return parse<ProcessResult>(
    await send("/api/v1/cv/preprocess", {
      method: "POST",
      body: form({ image_id: imageId, operation, parameters: JSON.stringify(parameters) }),
    }),
  );
}

export async function detect(imageId: string, confidence: number, maxResults: number) {
  return parse<DetectionResult>(
    await send("/api/v1/cv/detect", {
      method: "POST",
      body: form({
        image_id: imageId,
        confidence: String(confidence),
        max_results: String(maxResults),
      }),
    }),
  );
}

export async function segment(imageId: string, method: string, parameters: Record<string, unknown>) {
  return parse<SegmentResult>(
    await send("/api/v1/cv/segment", {
      method: "POST",
      body: form({ image_id: imageId, method, parameters: JSON.stringify(parameters) }),
    }),
  );
}

export async function ocr(imageId: string) {
  return parse<OcrResult>(
    await send("/api/v1/cv/ocr", { method: "POST", body: form({ image_id: imageId }) }),
  );
}

export async function similarity(imageId: string, candidates: string[]) {
  return parse<SimilarityResult>(
    await send("/api/v1/cv/similarity", {
      method: "POST",
      body: form({ image_id: imageId, candidates: JSON.stringify(candidates) }),
    }),
  );
}

export async function askVision(imageId: string, question: string) {
  return parse<VisionResult>(
    await send("/api/v1/ai/vision-question", {
      method: "POST",
      body: form({ image_id: imageId, question }),
    }),
  );
}

export async function createReport(payload: {
  image_id: string;
  include_classical: boolean;
  include_detection: boolean;
  include_segmentation: boolean;
  include_ocr: boolean;
  include_similarity: boolean;
  include_vlm: boolean;
  use_llm: boolean;
  user_observation: string | null;
}) {
  return parse<ReportResult>(
    await send("/api/v1/ai/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}
