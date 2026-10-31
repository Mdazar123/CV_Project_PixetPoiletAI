"use client";

import { createContext, useContext } from "react";
import type {
  Activity,
  Capabilities,
  DetectionResult,
  HistoryItem,
  ImageMetadata,
  OcrResult,
  PixelReadout,
  ProcessResult,
  ReportResult,
  SegmentResult,
  SimilarityResult,
  VisionResult,
} from "@/lib/types";

export type Mode =
  | "inspect"
  | "classical"
  | "detect"
  | "segment"
  | "ocr"
  | "similarity"
  | "ask"
  | "report"
  | "compare";

export type WorkspaceApi = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  busy: boolean;
  error: string | null;
  metadata: ImageMetadata | null;
  previewUrl: string | null;
  fileName: string | null;
  capabilities: Capabilities | null;
  health: "unknown" | "ok" | "down";
  serviceName: string;
  pixel: PixelReadout | null;
  classical: ProcessResult | null;
  detection: DetectionResult | null;
  selectedDetection: number | null;
  setSelectedDetection: (index: number | null) => void;
  detectionView: "overlay" | "annotated";
  setDetectionView: (view: "overlay" | "annotated") => void;
  segmentation: SegmentResult | null;
  segmentView: "overlay" | "mask";
  setSegmentView: (view: "overlay" | "mask") => void;
  ocr: OcrResult | null;
  selectedOcr: number | null;
  setSelectedOcr: (index: number | null) => void;
  similarity: SimilarityResult | null;
  vision: VisionResult | null;
  reportResult: ReportResult | null;
  history: HistoryItem[];
  compareLeft: string;
  compareRight: string;
  setCompareLeft: (id: string) => void;
  setCompareRight: (id: string) => void;
  observation: string;
  setObservation: (value: string) => void;
  failureTag: string;
  setFailureTag: (value: string) => void;
  zoom: "fit" | "actual";
  setZoom: (zoom: "fit" | "actual") => void;
  showOriginal: boolean;
  setShowOriginal: (value: boolean) => void;
  activity: Activity;
  uploadFile: (file: File) => Promise<void>;
  loadSample: (path: string, name: string) => Promise<void>;
  clearWorkspace: () => Promise<void>;
  readPixel: (x: number, y: number) => Promise<void>;
  runClassical: (operation: string, parameters: Record<string, unknown>) => Promise<void>;
  runDetection: (confidence: number, maxResults: number) => Promise<void>;
  runSegmentation: (method: string, parameters: Record<string, unknown>) => Promise<void>;
  runOcr: () => Promise<void>;
  runSimilarity: (text: string) => Promise<void>;
  ask: (question: string) => Promise<void>;
  generateReport: (useLlm: boolean) => Promise<void>;
};

export const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace controls are outside the workbench.");
  return value;
}
