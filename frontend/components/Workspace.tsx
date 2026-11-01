"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  askVision,
  createReport,
  dataUrl,
  deleteImage,
  detect,
  getCapabilities,
  getHealth,
  inspectImage,
  ocr,
  preprocess,
  readPixels,
  segment,
  similarity,
} from "@/lib/api";
import { formatMs, validateImageFile } from "@/lib/format";
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
  Timing,
  VisionResult,
} from "@/lib/types";
import { Activity as ActivityIcon, Gauge, ScanSearch, Zap } from "lucide-react";
import { Controls } from "./Controls";
import { Inspector } from "./Inspector";
import { MODES, Shell } from "./Shell";
import { Stage, type StageBox } from "./Stage";
import { WorkspaceContext, type Mode, type WorkspaceApi } from "./context";

const idleActivity: Activity = { label: "Idle", state: "idle" };

export function Workspace() {
  const [mode, setMode] = useState<Mode>("inspect");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [health, setHealth] = useState<"unknown" | "ok" | "down">("unknown");
  const [serviceName, setServiceName] = useState("pixelpilot-api");
  const [pixel, setPixel] = useState<PixelReadout | null>(null);
  const [classical, setClassical] = useState<ProcessResult | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [selectedDetection, setSelectedDetection] = useState<number | null>(null);
  const [detectionView, setDetectionView] = useState<"overlay" | "annotated">("overlay");
  const [segmentation, setSegmentation] = useState<SegmentResult | null>(null);
  const [segmentView, setSegmentView] = useState<"overlay" | "mask">("overlay");
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [selectedOcr, setSelectedOcr] = useState<number | null>(null);
  const [similarityResult, setSimilarityResult] = useState<SimilarityResult | null>(null);
  const [vision, setVision] = useState<VisionResult | null>(null);
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [compareLeft, setCompareLeft] = useState("original");
  const [compareRight, setCompareRight] = useState("");
  const sourceFileRef = useRef<File | null>(null);
  const metadataRef = useRef<ImageMetadata | null>(null);
  metadataRef.current = metadata;
  const [observation, setObservation] = useState("");
  const [failureTag, setFailureTag] = useState("");
  const [zoom, setZoom] = useState<"fit" | "actual">("fit");
  const [mobileNav, setMobileNav] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [activity, setActivity] = useState<Activity>(idleActivity);

  useEffect(() => {
    let stopped = false;
    async function ping() {
      try {
        const body = await getHealth();
        if (stopped) return;
        setHealth("ok");
        setServiceName(body.service);
      } catch {
        if (!stopped) setHealth("down");
      }
    }
    void ping();
    const timer = window.setInterval(() => void ping(), 15000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (health !== "ok") return;
    void getCapabilities().then(setCapabilities).catch(() => setCapabilities(null));
  }, [health]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      const index = Number(event.key) - 1;
      const next = MODES[index];
      if (next && next.id !== "ask") setMode(next.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function resetResults() {
    setPixel(null);
    setClassical(null);
    setDetection(null);
    setSelectedDetection(null);
    setSegmentation(null);
    setOcrResult(null);
    setSelectedOcr(null);
    setSimilarityResult(null);
    setVision(null);
    setReportResult(null);
    setHistory([]);
    setCompareRight("");
    setShowOriginal(false);
    setObservation("");
    setFailureTag("");
  }

  async function execute<T extends { request_id: string; timing?: Timing }>(label: string, action: () => Promise<T>) {
    setBusy(true);
    setError(null);
    setActivity({ label, state: "running" });
    const started = performance.now();
    try {
      const result = await action();
      setActivity({
        label,
        state: "ok",
        requestId: result.request_id,
        timing: result.timing,
        requestMs: Math.round(performance.now() - started),
      });
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "The request failed.";
      setError(message);
      setActivity({
        label,
        state: "error",
        requestId: err instanceof ApiError ? err.requestId : undefined,
        requestMs: Math.round(performance.now() - started),
      });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function callWithImage<T>(action: (imageId: string) => Promise<T>) {
    const currentId = metadataRef.current?.image_id;
    if (!currentId) throw new ApiError("IMAGE_NOT_FOUND", "Upload an image first.");
    try {
      return await action(currentId);
    } catch (error) {
      const file = sourceFileRef.current;
      if (!(error instanceof ApiError) || error.code !== "IMAGE_NOT_FOUND" || !file) throw error;
      const inspected = await inspectImage(file);
      metadataRef.current = inspected;
      setMetadata(inspected);
      return action(inspected.image_id);
    }
  }

  function remember(item: HistoryItem) {
    setHistory((current) => [item, ...current.filter((entry) => entry.title !== item.title)].slice(0, 12));
    setCompareRight(item.id);
  }

  async function uploadFile(file: File) {
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const localUrl = URL.createObjectURL(file);
    const previousId = metadata?.image_id;
    const previousUrl = previewUrl;
    const previousFile = sourceFileRef.current;
    sourceFileRef.current = file;
    try {
      const inspected = await inspectImage(file);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      if (previousId) void deleteImage(previousId).catch(() => undefined);
      metadataRef.current = inspected;
      setPreviewUrl(localUrl);
      setMetadata(inspected);
      setFileName(file.name);
      resetResults();
      setActivity({
        label: "Inspect",
        state: "ok",
        requestId: inspected.request_id,
        requestMs: inspected.processing_time_ms,
        timing: {
          processing_time_ms: inspected.processing_time_ms,
          inference_time_ms: null,
          model_load_time_ms: null,
          inference_scope: "not_applicable",
        },
      });
      setMode("inspect");
    } catch (err) {
      sourceFileRef.current = previousFile;
      URL.revokeObjectURL(localUrl);
      setError(err instanceof ApiError ? err.message : "The image could not be inspected.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSample(path: string, name: string) {
    const response = await fetch(path);
    if (!response.ok) {
      setError("The sample image could not be loaded.");
      return;
    }
    const blob = await response.blob();
    await uploadFile(new File([blob], name, { type: blob.type || "image/png" }));
  }

  async function clearWorkspace() {
    const currentId = metadata?.image_id;
    if (currentId) void deleteImage(currentId).catch(() => undefined);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    sourceFileRef.current = null;
    metadataRef.current = null;
    setPreviewUrl(null);
    setMetadata(null);
    setFileName(null);
    setError(null);
    resetResults();
    setActivity(idleActivity);
  }

  async function readPixel(x: number, y: number) {
    if (!metadata) return;
    try {
      setPixel(await callWithImage((imageId) => readPixels(imageId, x, y)));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The pixel could not be read.");
    }
  }

  const api: WorkspaceApi = {
    mode,
    setMode,
    busy,
    error,
    metadata,
    previewUrl,
    fileName,
    capabilities,
    health,
    serviceName,
    pixel,
    classical,
    detection,
    selectedDetection,
    setSelectedDetection,
    detectionView,
    setDetectionView,
    segmentation,
    segmentView,
    setSegmentView,
    ocr: ocrResult,
    selectedOcr,
    setSelectedOcr,
    similarity: similarityResult,
    vision,
    reportResult,
    history,
    compareLeft,
    compareRight,
    setCompareLeft,
    setCompareRight,
    observation,
    setObservation,
    failureTag,
    setFailureTag,
    zoom,
    setZoom,
    showOriginal,
    setShowOriginal,
    activity,
    uploadFile,
    loadSample,
    clearWorkspace,
    readPixel,
    async runClassical(operation, parameters) {
      if (!metadata) return;
      const result = await execute(`Classical · ${operation}`, () =>
        callWithImage((imageId) => preprocess(imageId, operation, parameters)),
      );
      if (!result) return;
      setClassical(result);
      setShowOriginal(false);
      remember({
        id: `${operation}-${result.request_id}`,
        title: operation,
        source: "OpenCV",
        src: dataUrl(result.media_type, result.image_base64),
        processing: result.timing.processing_time_ms,
        inference: result.timing.inference_time_ms,
        scope: result.timing.inference_scope,
      });
    },
    async runDetection(confidence, maxResults) {
      if (!metadata) return;
      const result = await execute("Object detection", () =>
        callWithImage((imageId) => detect(imageId, confidence, maxResults)),
      );
      if (!result) return;
      setDetection(result);
      setSelectedDetection(result.detections[0] ? 0 : null);
      remember({
        id: `detect-${result.request_id}`,
        title: "Detection",
        source: result.model,
        src: dataUrl(result.media_type, result.annotated_image_base64),
        processing: result.timing.processing_time_ms,
        inference: result.timing.inference_time_ms,
        scope: result.timing.inference_scope,
      });
    },
    async runSegmentation(method, parameters) {
      if (!metadata) return;
      const result = await execute(`Segmentation · ${method}`, () =>
        callWithImage((imageId) => segment(imageId, method, parameters)),
      );
      if (!result) return;
      setSegmentation(result);
      setSegmentView("overlay");
      remember({
        id: `segment-${result.request_id}`,
        title: method === "deeplab" ? "DeepLab mask" : "GrabCut",
        source: result.model,
        src: dataUrl(result.media_type, result.overlay_base64),
        processing: result.timing.processing_time_ms,
        inference: result.timing.inference_time_ms,
        scope: result.timing.inference_scope,
      });
    },
    async runOcr() {
      if (!metadata) return;
      const result = await execute("OCR", () => callWithImage((imageId) => ocr(imageId)));
      if (!result) return;
      setOcrResult(result);
      setSelectedOcr(result.text_regions[0] ? 0 : null);
      if (previewUrl) {
        remember({
          id: `ocr-${result.request_id}`,
          title: "OCR",
          source: result.model,
          src: previewUrl,
          boxes: result.text_regions.map((region, index) => ({
            id: String(index),
            ...region.bbox,
            label: region.text,
            tone: "ocr" as const,
          })),
          processing: result.timing.processing_time_ms,
          inference: result.timing.inference_time_ms,
          scope: result.timing.inference_scope,
        });
      }
    },
    async runSimilarity(text) {
      if (!metadata) return;
      const candidates = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      await execute("Similarity", async () => {
        const result = await callWithImage((imageId) => similarity(imageId, candidates));
        setSimilarityResult(result);
        return result;
      });
    },
    async ask(question) {
      if (!metadata) return;
      const result = await execute("Vision question", () => callWithImage((imageId) => askVision(imageId, question)));
      if (result) setVision(result);
    },
    async generateReport(useLlm) {
      if (!metadata) return;
      const note = [failureTag ? `Tagged by user: ${failureTag}.` : "", observation.trim()].filter(Boolean).join(" ").slice(0, 500);
      const result = await execute("Report", () =>
        callWithImage((imageId) =>
          createReport({
            image_id: imageId,
            include_classical: classical !== null,
            include_detection: detection !== null,
            include_segmentation: segmentation !== null,
            include_ocr: ocrResult !== null,
            include_similarity: similarityResult !== null,
            include_vlm: vision !== null,
            use_llm: useLlm,
            user_observation: note || null,
          }),
        ),
      );
      if (result) setReportResult(result);
    },
  };

  const stage = useMemo(() => {
    let src = previewUrl;
    let alt = fileName ? `Original image ${fileName}` : "Original image";
    let boxes: StageBox[] = [];
    if (mode === "classical" && classical && !showOriginal) {
      src = dataUrl(classical.media_type, classical.image_base64);
      alt = `${classical.operation} result`;
    }
    if (mode === "detect" && detection && detectionView === "annotated") {
      src = dataUrl(detection.media_type, detection.annotated_image_base64);
      alt = "Detector rendering with boxes and labels";
    }
    if (mode === "detect" && detection && detectionView === "overlay") {
      boxes = detection.detections.map((item, index) => ({
        id: String(index),
        ...item.bbox,
        label: `${item.label} ${item.confidence.toFixed(2)}`,
        selected: selectedDetection === index,
        tone: "detect" as const,
      }));
      alt = "Original image with detector boxes";
    }
    if (mode === "segment" && segmentation) {
      src = dataUrl(segmentation.media_type, segmentView === "mask" ? segmentation.mask_base64 : segmentation.overlay_base64);
      alt = segmentView === "mask" ? "Segmentation mask" : "Segmentation overlay";
    }
    if (mode === "ocr" && ocrResult) {
      boxes = ocrResult.text_regions.map((region, index) => ({
        id: String(index),
        ...region.bbox,
        label: region.text,
        selected: selectedOcr === index,
        tone: "ocr" as const,
      }));
      alt = "Original image with OCR regions";
    }
    return { src, alt, boxes };
  }, [previewUrl, fileName, mode, classical, showOriginal, detection, detectionView, selectedDetection, segmentation, segmentView, ocrResult, selectedOcr]);

  function frameFor(id: string) {
    if (id === "original") {
      return { src: previewUrl, title: "Original", caption: fileName ?? "Uploaded image", boxes: [] };
    }
    const item = history.find((entry) => entry.id === id);
    if (!item) return { src: null, title: "Result", caption: "Run an analysis to compare it.", boxes: [] };
    const inference =
      item.scope === "measured" && item.inference != null
        ? `Inference ${item.inference.toFixed(1)} ms`
        : "No separate inference step";
    return {
      src: item.src,
      title: item.title,
      caption: `${item.source} · Server processing ${item.processing?.toFixed(1) ?? "unavailable"} ms · ${inference}`,
      boxes: (item.boxes ?? []).map((box) => ({ ...box, selected: false })),
    };
  }

  const leftFrame = frameFor(compareLeft);
  const rightFrame = frameFor(compareRight);
  const detectionScores = detection?.detections ?? [];
  const averageConfidence = detectionScores.length
    ? detectionScores.reduce((sum, item) => sum + item.confidence, 0) / detectionScores.length
    : null;
  const latencyMs = activity.timing?.processing_time_ms ?? activity.requestMs ?? null;
  const readyModels = [
    capabilities?.classical.available,
    capabilities?.detector.available,
    capabilities?.segmentation.grabcut.available,
    capabilities?.segmentation.deeplab.available,
    capabilities?.ocr.available,
    capabilities?.similarity.available,
  ].filter(Boolean).length;
  const modelChip =
    mode === "detect" && detection
      ? detection.model
      : mode === "segment" && segmentation
        ? segmentation.model
        : mode === "ocr" && ocrResult
          ? ocrResult.model
          : mode === "classical" && classical
            ? classical.operation
            : mode === "similarity" && similarityResult
              ? similarityResult.model
              : mode === "ask" && vision
                ? vision.model
                : mode === "report" && reportResult?.llm_model
                  ? reportResult.llm_model
                  : null;

  return (
    <WorkspaceContext.Provider value={api}>
      <Shell
        mode={mode}
        setMode={setMode}
        mobileNav={mobileNav}
        setMobileNav={setMobileNav}
        health={health}
        serviceName={serviceName}
        fileName={fileName}
        metadata={metadata}
        busy={busy}
        canExport={Boolean(stage.src)}
        onExport={() => {
          if (!stage.src) return;
          const link = document.createElement("a");
          link.href = stage.src;
          link.download = fileName || "pixelpilot-view.png";
          link.click();
        }}
        onUpload={(file) => void uploadFile(file)}
        onSample={(path, name) => void loadSample(path, name)}
        onClear={() => void clearWorkspace()}
        modelChip={modelChip}
        stats={[
          {
            label: "Objects detected",
            value: detection ? String(detection.detection_count) : "--",
            detail: detection ? detection.model : "Run detection",
            icon: ScanSearch,
            accent: "cyan",
          },
          {
            label: "Avg. confidence",
            value: averageConfidence == null ? "--" : `${(averageConfidence * 100).toFixed(1)}%`,
            detail: !detection ? "No detections yet" : averageConfidence == null ? "Run finished with no boxes" : "Mean of returned scores",
            icon: Gauge,
            accent: "violet",
          },
          {
            label: "Pipeline latency",
            value: formatMs(latencyMs) ?? "--",
            detail: latencyMs == null ? "No run yet" : activity.label,
            icon: Zap,
            accent: "amber",
          },
          {
            label: "Models ready",
            value: capabilities ? String(readyModels).padStart(2, "0") : "--",
            detail: capabilities ? "Available on this server" : "Waiting for API",
            icon: ActivityIcon,
            accent: "emerald",
          },
        ]}
        stage={
          <div className="stage-well" aria-busy={busy}>
            <div className="stage-dock">
              <div className="segmented">
                <button type="button" className={zoom === "fit" ? "active" : ""} onClick={() => setZoom("fit")}>
                  Fit
                </button>
                <button type="button" className={zoom === "actual" ? "active" : ""} onClick={() => setZoom("actual")}>
                  Actual size
                </button>
              </div>
              {busy && <span className="chip">Running {activity.label}</span>}
            </div>
              {mode === "compare" ? (
                <div className="compare-grid">
                  <figure>
                    <figcaption>
                      {leftFrame.title} · {leftFrame.caption}
                    </figcaption>
                    <Stage src={leftFrame.src} alt={leftFrame.title} boxes={leftFrame.boxes} zoom={zoom} />
                  </figure>
                  <figure>
                    <figcaption>
                      {rightFrame.title} · {rightFrame.caption}
                    </figcaption>
                    <Stage src={rightFrame.src} alt={rightFrame.title} boxes={rightFrame.boxes} zoom={zoom} />
                  </figure>
                </div>
              ) : mode === "report" && reportResult ? (
                <article className="report-doc">
                  <h2>Analysis report</h2>
                  <p>{reportResult.report.summary}</p>
                  {reportResult.llm_notice && <p className="callout">{reportResult.llm_notice}</p>}
                  <h3>Observations</h3>
                  <ul className="report-list">
                    {reportResult.report.observations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {reportResult.report.interpretations.length > 0 && (
                    <>
                      <h3>Interpretations</h3>
                      <ul className="report-list">
                        {reportResult.report.interpretations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {reportResult.report.limitations.length > 0 && (
                    <>
                      <h3>Limitations</h3>
                      <ul className="report-list">
                        {reportResult.report.limitations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {reportResult.report.recommendations.length > 0 && (
                    <>
                      <h3>Next steps</h3>
                      <ul className="report-list">
                        {reportResult.report.recommendations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {reportResult.report.user_observation && (
                    <p className="callout">Your note: {reportResult.report.user_observation}</p>
                  )}
                  {reportResult.llm_narrative && (
                    <div className="narrative">
                      <h3>Language-model narrative · {reportResult.llm_model}</h3>
                      <p>{reportResult.llm_narrative}</p>
                    </div>
                  )}
                </article>
              ) : (
                <div>
                  <Stage
                    src={stage.src}
                    alt={stage.alt}
                    boxes={stage.boxes}
                    zoom={zoom}
                    onPick={mode === "inspect" ? (x, y) => void readPixel(x, y) : undefined}
                    onBox={(id) => {
                      if (mode === "detect") setSelectedDetection(Number(id));
                      if (mode === "ocr") setSelectedOcr(Number(id));
                    }}
                  />
                  {mode === "detect" && detection && detectionView === "overlay" && (
                    <p className="legend">
                      <i className="detect" /> Detector boxes
                    </p>
                  )}
                  {mode === "ocr" && ocrResult && (
                    <p className="legend">
                      <i className="ocr" /> OCR regions
                    </p>
                  )}
                </div>
              )}
            </div>
        }
        tools={
          <>
            <Controls />
            <Inspector />
          </>
        }
      />
    </WorkspaceContext.Provider>
  );
}
