"use client";

import { useState } from "react";

export type StageBox = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  selected: boolean;
  tone: "detect" | "ocr";
};

type StageProps = {
  src: string | null;
  alt: string;
  boxes?: StageBox[];
  zoom: "fit" | "actual";
  onPick?: (x: number, y: number) => void;
  onBox?: (id: string) => void;
};

export function Stage({ src, alt, boxes = [], zoom, onPick, onBox }: StageProps) {
  const [natural, setNatural] = useState({ width: 0, height: 0 });

  if (!src) {
    return (
      <div className="empty-state">
        <div className="empty-mark" aria-hidden="true" />
        <h2>Start with a picture</h2>
        <p className="hint">Drop an image in the sidebar, or open Geometry and Text card.</p>
      </div>
    );
  }

  return (
    <div className={`frame ${zoom === "actual" ? "actual" : ""}`}>
      <img
        src={src}
        alt={alt}
        onLoad={(event) =>
          setNatural({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })
        }
        onClick={(event) => {
          if (!onPick) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = Math.floor(((event.clientX - rect.left) / rect.width) * event.currentTarget.naturalWidth);
          const y = Math.floor(((event.clientY - rect.top) / rect.height) * event.currentTarget.naturalHeight);
          onPick(Math.max(0, x), Math.max(0, y));
        }}
      />
      {natural.width > 0 && boxes.length > 0 && (
        <svg viewBox={`0 0 ${natural.width} ${natural.height}`} preserveAspectRatio="none">
          {boxes.map((box) => {
            const palette = ["#67e8f9", "#c4b5fd", "#fcd34d"];
            const color = box.tone === "ocr" ? "#67e8f9" : palette[Number(box.id) % palette.length] || "#67e8f9";
            return (
              <g key={box.id} onClick={() => onBox?.(box.id)}>
                <rect
                  x={box.x1}
                  y={box.y1}
                  width={Math.max(1, box.x2 - box.x1)}
                  height={Math.max(1, box.y2 - box.y1)}
                  fill={box.selected ? "rgba(103, 232, 249, 0.16)" : "transparent"}
                  stroke={box.selected ? "#67e8f9" : color}
                  strokeWidth={box.selected ? 3 : 2}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={box.x1 + 4}
                  y={Math.max(16, box.y1 - 6)}
                  fill={color}
                  fontSize={Math.max(14, natural.width / 48)}
                  fontFamily="Inter, ui-sans-serif, sans-serif"
                >
                  {box.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
