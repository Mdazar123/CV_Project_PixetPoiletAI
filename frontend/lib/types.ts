export type Timing = {
  processing_time_ms: number;
  inference_time_ms: number | null;
  model_load_time_ms: number | null;
  inference_scope: "measured" | "not_applicable" | "unavailable";
};

export type ImageMetadata = {
  image_id: string;
  width: number;
  height: number;
  channels: number;
  dtype: string;
  format: string;
  file_size_bytes: number;
  color_space: string;
  alpha_discarded: boolean;
  processing_time_ms: number;
  request_id: string;
  note: string;
};

export type BBox = { x1: number; y1: number; x2: number; y2: number };

export type Detection = {
  class_id: number;
  label: string;
  confidence: number;
  bbox: BBox;
};

export type ProcessResult = {
  image_id: string;
  operation: string;
  parameters: Record<string, unknown>;
  width: number;
  height: number;
  channels: number;
  dtype: string;
  image_base64: string;
  media_type: string;
  extras: {
    contour_count?: number;
    contours?: { area: number; bbox: BBox }[];
    preprocessed?: string | null;
    sigma_note?: string | null;
    display?: string;
  };
  concept_note: string;
  timing: Timing;
  request_id: string;
};

export type DetectionResult = {
  image_id: string;
  model: string;
  task: string;
  coordinate_system: string;
  coordinate_note: string;
  image_width: number;
  image_height: number;
  confidence_threshold: number;
  detection_count: number;
  detections: Detection[];
  annotated_image_base64: string;
  media_type: string;
  timing: Timing;
  note: string;
  request_id: string;
};

export type SegmentClass = { class_id: number; label: string; pixel_count: number };

export type SegmentResult = {
  image_id: string;
  model: string;
  method: string;
  task: string;
  image_width: number;
  image_height: number;
  classes: SegmentClass[];
  rect: { x: number; y: number; width: number; height: number } | null;
  overlay_base64: string;
  mask_base64: string;
  media_type: string;
  note: string;
  timing: Timing;
  request_id: string;
};

export type OcrRegion = { text: string; confidence: number | null; bbox: BBox };

export type OcrResult = {
  image_id: string;
  model: string;
  image_width: number;
  image_height: number;
  region_count: number;
  text_regions: OcrRegion[];
  full_text: string;
  timing: Timing;
  note: string;
  request_id: string;
};

export type SimilarityResult = {
  image_id: string;
  model: string;
  score_type: string;
  score_note: string;
  rankings: { rank: number; text: string; score: number }[];
  device: string;
  timing: Timing;
  request_id: string;
};

export type VisionResult = {
  image_id: string;
  model: string;
  provider: string;
  answer: string;
  verified: boolean;
  resized_for_provider: boolean;
  note: string;
  timing: Timing;
  request_id: string;
};

export type ReportResult = {
  image_id: string;
  model: string;
  llm_model: string | null;
  llm_status: string;
  llm_narrative: string | null;
  llm_notice: string | null;
  report: {
    summary: string;
    observations: string[];
    interpretations: string[];
    limitations: string[];
    recommendations: string[];
    user_observation: string | null;
  };
  evidence: Record<string, unknown>;
  timing: Timing;
  request_id: string;
};

export type Capabilities = {
  classical: { available: boolean; operations: string[] };
  detector: { available: boolean; model: string; task: string; reason: string | null };
  segmentation: {
    grabcut: { available: boolean; model: string; reason: string | null };
    deeplab: { available: boolean; model: string; reason: string | null };
  };
  ocr: { available: boolean; model: string | null; reason: string | null };
  similarity: { available: boolean; model: string; reason: string | null };
  vlm: { configured: boolean; model: string | null; reason: string | null };
  llm: { configured: boolean; model: string | null; reason: string | null };
  storage: string;
};

export type PixelReadout = {
  note: string;
  color_space: string;
  pixels: { x: number; y: number; bgr?: number[]; rgb?: number[]; gray?: number }[];
};

export type HistoryBox = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  tone: "detect" | "ocr";
};

export type HistoryItem = {
  id: string;
  title: string;
  source: string;
  src: string;
  boxes?: HistoryBox[];
  processing: number | null;
  inference: number | null;
  scope: Timing["inference_scope"];
};

export type Activity = {
  label: string;
  state: "idle" | "running" | "ok" | "error";
  requestId?: string;
  timing?: Timing | null;
  requestMs?: number | null;
};
