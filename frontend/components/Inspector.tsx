"use client";

import { formatBytes, formatMs } from "@/lib/format";
import { useWorkspace } from "./context";

export function Inspector() {
  const workspace = useWorkspace();
  const metadata = workspace.metadata;
  const pixel = workspace.pixel?.pixels[0];
  const timing = workspace.activity.timing;

  return (
    <div className="inspector-block">
      <p className="section-label">Details</p>
      {workspace.error && (
        <div className="banner" role="alert">
          <span className="banner-tag">Error</span>
          <span>{workspace.error}</span>
        </div>
      )}
      {!metadata && <p className="hint">Metadata, scores, and timing appear here after an image is loaded.</p>}
      {metadata && (
        <section className="card">
          <h3>Decoded image</h3>
          <dl className="meta-grid">
            <div>
              <dt>Size</dt>
              <dd>
                {metadata.width}×{metadata.height}
              </dd>
            </div>
            <div>
              <dt>Channels</dt>
              <dd>{metadata.channels}</dd>
            </div>
            <div>
              <dt>Color space</dt>
              <dd>{metadata.color_space}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{metadata.dtype}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{metadata.format}</dd>
            </div>
            <div>
              <dt>File</dt>
              <dd>{formatBytes(metadata.file_size_bytes)}</dd>
            </div>
          </dl>
          {metadata.alpha_discarded && <p className="callout">The alpha channel was discarded before analysis.</p>}
          <p className="callout">{metadata.note}</p>
        </section>
      )}

      {workspace.mode === "inspect" && (
        <section className="pixel-card">
          <h3>Pixel</h3>
          {!pixel && <p className="hint">Click the image to sample one pixel.</p>}
          {pixel && (
            <>
              <p className="mono">
                x {pixel.x} · y {pixel.y}
              </p>
              {pixel.gray != null && <p>Gray {pixel.gray}</p>}
              {pixel.bgr && (
                <p className="mono">
                  BGR {pixel.bgr.join(", ")}
                  <br />
                  RGB {pixel.rgb?.join(", ")}
                </p>
              )}
              <p className="callout">{workspace.pixel?.note}</p>
            </>
          )}
        </section>
      )}

      {workspace.mode === "classical" && workspace.classical && (
        <section className="card">
          <h3>{workspace.classical.operation}</h3>
          <p className="callout">{workspace.classical.concept_note}</p>
          {workspace.classical.extras.contour_count != null && (
            <p className="mono">Contours {workspace.classical.extras.contour_count}</p>
          )}
          {workspace.classical.extras.preprocessed && <p className="callout">{workspace.classical.extras.preprocessed}</p>}
          <p className="mono">
            Output {workspace.classical.width}×{workspace.classical.height} · {workspace.classical.channels} ch
          </p>
        </section>
      )}

      {workspace.mode === "detect" && workspace.detection && (
        <section className="card">
          <h3>{workspace.detection.model}</h3>
          <p className="callout">{workspace.detection.note}</p>
          <p className="mono">
            {workspace.detection.detection_count} detection{workspace.detection.detection_count === 1 ? "" : "s"} · threshold{" "}
            {workspace.detection.confidence_threshold}
          </p>
          {workspace.detection.detection_count === 0 ? (
            <p className="callout">The detector finished and found no objects above the threshold.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Score</th>
                    <th>Box</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.detection.detections.map((item, index) => (
                    <tr key={`${item.label}-${index}`} className={workspace.selectedDetection === index ? "selected" : ""}>
                      <td>
                        <button className="linkish" type="button" onClick={() => workspace.setSelectedDetection(index)}>
                          {item.label}
                        </button>
                      </td>
                      <td>{item.confidence.toFixed(2)}</td>
                      <td>
                        {item.bbox.x1},{item.bbox.y1}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="legend">
            <i className="detect" /> Detector boxes
          </p>
        </section>
      )}

      {workspace.mode === "segment" && workspace.segmentation && (
        <section className="card">
          <h3>{workspace.segmentation.model}</h3>
          <p className="mono">{workspace.segmentation.task}</p>
          <p className="callout">{workspace.segmentation.note}</p>
          {workspace.segmentation.rect && (
            <p className="mono">
              Rectangle {workspace.segmentation.rect.x},{workspace.segmentation.rect.y}{" "}
              {workspace.segmentation.rect.width}×{workspace.segmentation.rect.height}
            </p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Pixels</th>
                </tr>
              </thead>
              <tbody>
                {workspace.segmentation.classes.map((item) => (
                  <tr key={`${item.class_id}-${item.label}`}>
                    <td>{item.label}</td>
                    <td>{item.pixel_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {workspace.mode === "ocr" && workspace.ocr && (
        <section className="card">
          <h3>{workspace.ocr.model}</h3>
          <p className="callout">{workspace.ocr.note}</p>
          {workspace.ocr.region_count === 0 ? (
            <p className="callout">OCR finished and returned no text regions.</p>
          ) : (
            <>
              <pre className="mono">{workspace.ocr.full_text}</pre>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Text</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.ocr.text_regions.map((region, index) => (
                      <tr key={`${region.text}-${index}`} className={workspace.selectedOcr === index ? "selected" : ""}>
                        <td>
                          <button className="linkish" type="button" onClick={() => workspace.setSelectedOcr(index)}>
                            {region.text}
                          </button>
                        </td>
                        <td>{region.confidence == null ? "n/a" : region.confidence.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="legend">
            <i className="ocr" /> OCR regions
          </p>
        </section>
      )}

      {workspace.mode === "similarity" && workspace.similarity && (
        <section className="card">
          <h3>{workspace.similarity.model}</h3>
          <p className="callout">{workspace.similarity.score_note}</p>
          <ol className="report-list">
            {workspace.similarity.rankings.map((item) => (
              <li key={item.rank}>
                {item.text} · {item.score.toFixed(4)}
              </li>
            ))}
          </ol>
        </section>
      )}

      {workspace.mode === "ask" && workspace.vision && (
        <section className="card">
          <h3>{workspace.vision.model}</h3>
          <p className="callout">{workspace.vision.note}</p>
          <p>{workspace.vision.answer}</p>
          <p className="mono">Verified flag: {workspace.vision.verified ? "true" : "false"}</p>
        </section>
      )}

      {workspace.mode === "report" && workspace.reportResult && (
        <section className="card">
          <h3>{workspace.reportResult.model}</h3>
          <p className="callout">{workspace.reportResult.llm_notice}</p>
          <dl className="meta-grid">
            <div>
              <dt>Detections</dt>
              <dd>{String(workspace.reportResult.evidence.detection_count ?? "not included")}</dd>
            </div>
            <div>
              <dt>OCR regions</dt>
              <dd>{String(workspace.reportResult.evidence.ocr_region_count ?? "not included")}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="card">
        <h3>Timing</h3>
        {!timing && workspace.activity.state === "idle" && <p className="hint">Run an operation to measure it.</p>}
        {timing && (
          <>
            <p className="mono" title="Time to prepare the input, run the operation, and encode the output on the server.">
              Server processing {formatMs(timing.processing_time_ms)}
            </p>
            <p className="mono" title="Time inside the model call. Model load is listed separately when it happens on this request.">
              {timing.inference_scope === "measured"
                ? `Inference ${formatMs(timing.inference_time_ms)}`
                : timing.inference_scope === "unavailable"
                  ? "Inference time unavailable"
                  : "No separate inference step"}
            </p>
            {timing.model_load_time_ms != null && <p className="mono">Model load {formatMs(timing.model_load_time_ms)}</p>}
          </>
        )}
        {workspace.activity.requestMs != null && (
          <p className="mono" title="Browser time from sending the request until the response was read. This includes network and server processing.">
            Request {formatMs(workspace.activity.requestMs)}
          </p>
        )}
      </section>
    </div>
  );
}
