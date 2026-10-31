"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./context";

type Field =
  | { kind: "range"; key: string; label: string; min: number; max: number; step: number; default: number }
  | { kind: "select"; key: string; label: string; default: string; options: { value: string; label: string }[] }
  | { kind: "number"; key: string; label: string; min: number; max: number; default: number };

const OPERATIONS: { id: string; label: string; fields: Field[] }[] = [
  { id: "grayscale", label: "Grayscale", fields: [] },
  {
    id: "gaussian_blur",
    label: "Gaussian blur",
    fields: [
      { kind: "range", key: "kernel_size", label: "Kernel", min: 1, max: 31, step: 2, default: 5 },
      { kind: "range", key: "sigma", label: "Sigma", min: 0, max: 20, step: 0.5, default: 0 },
    ],
  },
  {
    id: "threshold",
    label: "Threshold",
    fields: [
      {
        kind: "select",
        key: "method",
        label: "Method",
        default: "global",
        options: [
          { value: "global", label: "Global" },
          { value: "adaptive", label: "Adaptive" },
        ],
      },
      { kind: "range", key: "threshold", label: "Threshold", min: 0, max: 255, step: 1, default: 127 },
      { kind: "range", key: "block_size", label: "Block size", min: 3, max: 51, step: 2, default: 11 },
      { kind: "range", key: "c", label: "C", min: -20, max: 20, step: 1, default: 2 },
    ],
  },
  {
    id: "canny",
    label: "Canny edges",
    fields: [
      { kind: "range", key: "low_threshold", label: "Low", min: 0, max: 300, step: 1, default: 80 },
      { kind: "range", key: "high_threshold", label: "High", min: 1, max: 400, step: 1, default: 160 },
    ],
  },
  {
    id: "contours",
    label: "Contours",
    fields: [
      {
        kind: "select",
        key: "mode",
        label: "Source",
        default: "threshold",
        options: [
          { value: "threshold", label: "Threshold" },
          { value: "canny", label: "Canny" },
        ],
      },
      { kind: "range", key: "min_area", label: "Minimum area", min: 0, max: 5000, step: 10, default: 10 },
    ],
  },
  {
    id: "erosion",
    label: "Erosion",
    fields: [
      { kind: "range", key: "kernel_size", label: "Kernel", min: 1, max: 21, step: 2, default: 3 },
      { kind: "range", key: "iterations", label: "Iterations", min: 1, max: 8, step: 1, default: 1 },
    ],
  },
  {
    id: "dilation",
    label: "Dilation",
    fields: [
      { kind: "range", key: "kernel_size", label: "Kernel", min: 1, max: 21, step: 2, default: 3 },
      { kind: "range", key: "iterations", label: "Iterations", min: 1, max: 8, step: 1, default: 1 },
    ],
  },
  {
    id: "opening",
    label: "Opening",
    fields: [
      { kind: "range", key: "kernel_size", label: "Kernel", min: 1, max: 21, step: 2, default: 3 },
      { kind: "range", key: "iterations", label: "Iterations", min: 1, max: 8, step: 1, default: 1 },
    ],
  },
  {
    id: "closing",
    label: "Closing",
    fields: [
      { kind: "range", key: "kernel_size", label: "Kernel", min: 1, max: 21, step: 2, default: 3 },
      { kind: "range", key: "iterations", label: "Iterations", min: 1, max: 8, step: 1, default: 1 },
    ],
  },
  {
    id: "resize",
    label: "Resize",
    fields: [
      { kind: "number", key: "width", label: "Width", min: 1, max: 4096, default: 320 },
      { kind: "number", key: "height", label: "Height", min: 1, max: 4096, default: 240 },
    ],
  },
  {
    id: "rotate",
    label: "Rotate",
    fields: [{ kind: "range", key: "angle", label: "Angle", min: -180, max: 180, step: 1, default: 20 }],
  },
  {
    id: "flip",
    label: "Flip",
    fields: [
      {
        kind: "select",
        key: "mode",
        label: "Axis",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
          { value: "both", label: "Both" },
        ],
      },
    ],
  },
  {
    id: "crop",
    label: "Crop",
    fields: [
      { kind: "number", key: "crop_x", label: "X", min: 0, max: 4096, default: 0 },
      { kind: "number", key: "crop_y", label: "Y", min: 0, max: 4096, default: 0 },
      { kind: "number", key: "crop_width", label: "Width", min: 1, max: 4096, default: 200 },
      { kind: "number", key: "crop_height", label: "Height", min: 1, max: 4096, default: 200 },
    ],
  },
];

const QUESTIONS = [
  "What is visible in this image?",
  "Is there readable text? If you cannot read it, say so.",
  "Describe the lighting and the background.",
];

const TAGS = [
  "",
  "Missed object",
  "Wrong class",
  "False positive",
  "Partial object",
  "Weak segmentation",
  "OCR error",
  "Vision-language answer conflicts with the image",
  "Models disagree",
];

function defaults() {
  const values: Record<string, string | number> = {};
  for (const operation of OPERATIONS) {
    for (const field of operation.fields) values[field.key] = field.default;
  }
  values.method = "global";
  values.adaptive_method = "gaussian";
  values.seg_method = "grabcut";
  values.iterations = 5;
  values.confidence = 0.25;
  values.max_results = 20;
  return values;
}

export function Controls() {
  const workspace = useWorkspace();
  const [operation, setOperation] = useState("grayscale");
  const [values, setValues] = useState<Record<string, string | number>>(defaults);
  const [phrases, setPhrases] = useState("a green rectangle on gray\na page of printed text");
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [useLlm, setUseLlm] = useState(false);
  const current = OPERATIONS.find((item) => item.id === operation) ?? OPERATIONS[0];

  useEffect(() => {
    if (!workspace.metadata) return;
    setValues((currentValues) => ({
      ...currentValues,
      crop_width: workspace.metadata?.width ?? currentValues.crop_width,
      crop_height: workspace.metadata?.height ?? currentValues.crop_height,
      width: Math.min(320, workspace.metadata?.width ?? 320),
      height: Math.min(240, workspace.metadata?.height ?? 240),
    }));
  }, [workspace.metadata]);

  function update(key: string, value: string | number) {
    setValues((currentValues) => ({ ...currentValues, [key]: value }));
  }

  function classicalParameters() {
    const parameters: Record<string, unknown> = {};
    for (const field of current.fields) {
      const raw = values[field.key];
      if (field.key.startsWith("crop_")) parameters[field.key.replace("crop_", "")] = Number(raw);
      else parameters[field.key] = field.kind === "select" ? raw : Number(raw);
    }
    if (operation === "threshold") parameters.adaptive_method = "gaussian";
    if (operation === "resize") parameters.keep_aspect = true;
    return parameters;
  }

  const disabled = workspace.busy || !workspace.metadata;
  const detectorReason = workspace.capabilities?.detector.reason;
  const ocrReason = workspace.capabilities?.ocr.reason;
  const similarityReason = workspace.capabilities?.similarity.reason;
  const vlmReason = workspace.capabilities?.vlm.reason;
  const deeplabReason = workspace.capabilities?.segmentation.deeplab.reason;

  return (
    <div className="toolbar-card stack">
      {workspace.mode === "inspect" && (
        <>
          <h2>Image representation</h2>
          <p className="hint">Click the image to read one pixel. Color images are decoded as BGR for OpenCV and also shown as RGB.</p>
        </>
      )}

      {workspace.mode === "classical" && (
        <>
          <div className="title-row">
            <h2>Classical operation</h2>
            <button className="ghost" type="button" onClick={() => setValues(defaults())}>
              Reset
            </button>
          </div>
          <label className="field">
            <span>Operation</span>
            <select value={operation} onChange={(event) => setOperation(event.target.value)}>
              {OPERATIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {current.fields
            .filter((field) => {
              if (operation !== "threshold") return true;
              if (values.method === "adaptive") return field.key !== "threshold";
              return field.key !== "block_size" && field.key !== "c";
            })
            .map((field) => (
              <label className="field" key={field.key}>
                <span>
                  {field.label}
                  {field.kind !== "select" ? ` · ${values[field.key]}` : ""}
                </span>
                {field.kind === "select" ? (
                  <select value={String(values[field.key])} onChange={(event) => update(field.key, event.target.value)}>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.kind === "range" ? (
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={Number(values[field.key])}
                    onChange={(event) => update(field.key, Number(event.target.value))}
                  />
                ) : (
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={Number(values[field.key])}
                    onChange={(event) => update(field.key, Number(event.target.value))}
                  />
                )}
              </label>
            ))}
          {operation === "gaussian_blur" && Number(values.sigma) === 0 && (
            <p className="hint">Sigma 0 lets OpenCV derive sigma from the kernel size.</p>
          )}
          <div className="row-actions">
            <button className="primary" type="button" disabled={disabled} onClick={() => workspace.runClassical(operation, classicalParameters())}>
              Run {current.label}
            </button>
            <button className="ghost" type="button" onClick={() => workspace.setShowOriginal(!workspace.showOriginal)} disabled={!workspace.classical}>
              {workspace.showOriginal ? "Show result" : "Show original"}
            </button>
          </div>
        </>
      )}

      {workspace.mode === "detect" && (
        <>
          <h2>Object detection</h2>
          <p className="hint">EfficientDet Lite0 returns class labels and boxes. A result with zero objects is still a completed run.</p>
          <label className="field">
            <span>Confidence · {Number(values.confidence).toFixed(2)}</span>
            <input type="range" min={0.05} max={0.9} step={0.05} value={Number(values.confidence)} onChange={(event) => update("confidence", Number(event.target.value))} />
          </label>
          <label className="field">
            <span>Maximum boxes · {values.max_results}</span>
            <input type="range" min={1} max={20} step={1} value={Number(values.max_results)} onChange={(event) => update("max_results", Number(event.target.value))} />
          </label>
          {detectorReason && <p className="hint">{detectorReason}</p>}
          <div className="segmented">
            <button type="button" className={workspace.detectionView === "overlay" ? "active" : ""} onClick={() => workspace.setDetectionView("overlay")}>
              Boxes on original
            </button>
            <button type="button" className={workspace.detectionView === "annotated" ? "active" : ""} onClick={() => workspace.setDetectionView("annotated")}>
              Rendered labels
            </button>
          </div>
          <button
            className="primary"
            type="button"
            disabled={disabled || workspace.capabilities?.detector.available === false}
            onClick={() => workspace.runDetection(Number(values.confidence), Number(values.max_results))}
          >
            Run detection
          </button>
        </>
      )}

      {workspace.mode === "segment" && (
        <>
          <h2>Segmentation</h2>
          <label className="field">
            <span>Method</span>
            <select value={String(values.seg_method)} onChange={(event) => update("seg_method", event.target.value)}>
              <option value="grabcut">GrabCut foreground</option>
              <option value="deeplab" disabled={workspace.capabilities?.segmentation.deeplab.available === false}>
                DeepLabV3 semantic
              </option>
            </select>
          </label>
          {values.seg_method === "grabcut" ? (
            <p className="hint">GrabCut is classical foreground separation inside a rectangle. It does not assign Pascal VOC classes.</p>
          ) : (
            <p className="hint">DeepLabV3 assigns one Pascal VOC class per pixel, including background. It does not separate instances.</p>
          )}
          {values.seg_method === "deeplab" && deeplabReason && <p className="hint">{deeplabReason}</p>}
          {values.seg_method === "grabcut" && (
            <label className="field">
              <span>Iterations · {values.iterations}</span>
              <input type="range" min={1} max={5} step={1} value={Number(values.iterations)} onChange={(event) => update("iterations", Number(event.target.value))} />
            </label>
          )}
          <div className="segmented">
            <button type="button" className={workspace.segmentView === "overlay" ? "active" : ""} onClick={() => workspace.setSegmentView("overlay")}>
              Overlay
            </button>
            <button type="button" className={workspace.segmentView === "mask" ? "active" : ""} onClick={() => workspace.setSegmentView("mask")}>
              Mask
            </button>
          </div>
          <button
            className="primary"
            type="button"
            disabled={disabled || (values.seg_method === "deeplab" && workspace.capabilities?.segmentation.deeplab.available === false)}
            onClick={() =>
              workspace.runSegmentation(String(values.seg_method), values.seg_method === "grabcut" ? { iterations: Number(values.iterations) } : {})
            }
          >
            Run segmentation
          </button>
        </>
      )}

      {workspace.mode === "ocr" && (
        <>
          <h2>Text extraction</h2>
          <p className="hint">OCR text is the engine output. It stays separate from a vision-language reading of the same image.</p>
          {ocrReason && workspace.capabilities?.ocr.available === false && <p className="hint">{ocrReason}</p>}
          <button className="primary" type="button" disabled={disabled || workspace.capabilities?.ocr.available === false} onClick={() => workspace.runOcr()}>
            Run OCR
          </button>
        </>
      )}

      {workspace.mode === "similarity" && (
        <>
          <h2>Image-text similarity</h2>
          <p className="hint">One phrase per line, from 2 to 8. Scores are cosine similarities, not probabilities.</p>
          <label className="field">
            <span>Candidate phrases</span>
            <textarea value={phrases} onChange={(event) => setPhrases(event.target.value)} />
          </label>
          {similarityReason && <p className="hint">{similarityReason}</p>}
          <button
            className="primary"
            type="button"
            disabled={disabled || workspace.capabilities?.similarity.available === false}
            onClick={() => workspace.runSimilarity(phrases)}
          >
            Rank phrases
          </button>
        </>
      )}

      {workspace.mode === "ask" && (
        <>
          <h2>Vision question</h2>
          <p className="hint">The answer is a model interpretation. This workbench does not mark it as verified.</p>
          <div className="stack">
            {QUESTIONS.map((preset) => (
              <button key={preset} className="ghost" type="button" onClick={() => setQuestion(preset)}>
                {preset}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Question</span>
            <textarea value={question} maxLength={1000} onChange={(event) => setQuestion(event.target.value)} />
          </label>
          {vlmReason && <p className="hint">{vlmReason} The image is sent to the provider only when you ask.</p>}
          <button
            className="primary"
            type="button"
            disabled={disabled || !question.trim() || workspace.capabilities?.vlm.configured === false}
            onClick={() => workspace.ask(question.trim())}
          >
            Ask
          </button>
        </>
      )}

      {workspace.mode === "report" && (
        <>
          <h2>Grounded report</h2>
          <p className="hint">The report is built from analyses stored for this image. It can include a language-model narrative only when a provider is configured.</p>
          <label className="field">
            <span>
              <input type="checkbox" checked={useLlm} disabled={workspace.capabilities?.llm.configured === false} onChange={(event) => setUseLlm(event.target.checked)} /> Language-model narrative
            </span>
          </label>
          {workspace.capabilities?.llm.reason && <p className="hint">{workspace.capabilities.llm.reason}</p>}
          <button className="primary" type="button" disabled={disabled} onClick={() => workspace.generateReport(useLlm)}>
            Build report
          </button>
        </>
      )}

      {workspace.mode === "compare" && (
        <>
          <h2>Compare outputs</h2>
          <p className="hint">Each side names the operation or model that produced it. Disagreement is something to inspect, and this view does not decide a winner.</p>
          <label className="field">
            <span>Left</span>
            <select value={workspace.compareLeft} onChange={(event) => workspace.setCompareLeft(event.target.value)}>
              <option value="original">Original image</option>
              {workspace.history.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Right</span>
            <select value={workspace.compareRight} onChange={(event) => workspace.setCompareRight(event.target.value)}>
              <option value="">Choose a result</option>
              <option value="original">Original image</option>
              {workspace.history.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Your observation tag</span>
            <select value={workspace.failureTag} onChange={(event) => workspace.setFailureTag(event.target.value)}>
              {TAGS.map((tag) => (
                <option key={tag || "none"} value={tag}>
                  {tag || "No tag"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Your note</span>
            <textarea
              maxLength={500}
              value={workspace.observation}
              onChange={(event) => workspace.setObservation(event.target.value)}
              placeholder="This note is saved as your observation, separate from model output."
            />
          </label>
        </>
      )}
    </div>
  );
}
