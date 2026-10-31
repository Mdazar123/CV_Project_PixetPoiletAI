"use client";

import type { ReactNode } from "react";
import {
  Activity,
  Blend,
  Bot,
  CircleHelp,
  Download,
  FileText,
  GitCompareArrows,
  ImageIcon,
  Layers3,
  Menu,
  MoreHorizontal,
  ScanSearch,
  ScrollText,
  Sparkles,
  Upload,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/format";
import type { ImageMetadata } from "@/lib/types";
import { AskFloat } from "./AskFloat";
import type { Mode } from "./context";

export const MODES: { id: Mode; label: string; group: "Workspace" | "Interpret"; icon: LucideIcon }[] = [
  { id: "inspect", label: "Overview", group: "Workspace", icon: Activity },
  { id: "classical", label: "Image Lab", group: "Workspace", icon: WandSparkles },
  { id: "detect", label: "Detection", group: "Workspace", icon: ScanSearch },
  { id: "segment", label: "Segmentation", group: "Workspace", icon: Layers3 },
  { id: "ocr", label: "OCR", group: "Workspace", icon: FileText },
  { id: "similarity", label: "Similarity", group: "Workspace", icon: Blend },
  { id: "ask", label: "Assistant", group: "Interpret", icon: Bot },
  { id: "report", label: "Report", group: "Interpret", icon: ScrollText },
  { id: "compare", label: "Compare", group: "Interpret", icon: GitCompareArrows },
];

export type ShellStat = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent: "cyan" | "violet" | "amber" | "emerald";
};

type ShellProps = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  mobileNav: boolean;
  setMobileNav: (open: boolean) => void;
  health: "unknown" | "ok" | "down";
  serviceName: string;
  fileName: string | null;
  metadata: ImageMetadata | null;
  busy: boolean;
  canExport: boolean;
  onExport: () => void;
  onUpload: (file: File) => void;
  onSample: (path: string, name: string) => void;
  onClear: () => void;
  modelChip: string | null;
  stats: ShellStat[];
  stage: ReactNode;
  tools: ReactNode;
};

export function Shell({
  mode,
  setMode,
  mobileNav,
  setMobileNav,
  health,
  serviceName,
  fileName,
  metadata,
  busy,
  canExport,
  onExport,
  onUpload,
  onSample,
  onClear,
  modelChip,
  stats,
  stage,
  tools,
}: ShellProps) {
  const active = MODES.find((item) => item.id === mode) ?? MODES[0];
  const [chatOpen, setChatOpen] = useState(false);
  let group: string | null = null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setChatOpen((open) => !open);
        return;
      }
      if (!typing && event.key === "7") setChatOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="pixel-grid min-h-screen bg-[#0a0c12] text-slate-100 selection:bg-cyan-300 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-70">
        <div className="absolute -left-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-cyan-500/10 blur-[130px]" />
        <div className="absolute -right-32 top-1/3 h-[30rem] w-[30rem] rounded-full bg-violet-600/10 blur-[130px]" />
      </div>

      <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#0a0c12]/85 px-5 backdrop-blur-xl lg:px-7">
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Toggle navigation"
            type="button"
          >
            <Menu />
          </button>
          <div className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-cyan-300 to-violet-500 text-slate-950 shadow-[0_0_24px_rgba(103,232,249,.2)]">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">
              PixelPilot <span className="text-cyan-300">AI</span>
            </div>
            <div className="hidden text-[10px] uppercase tracking-[0.2em] text-slate-500 sm:block">Vision workbench</div>
          </div>
        </div>
        <div className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs md:flex ${health === "ok" ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300" : health === "down" ? "border-rose-400/20 bg-rose-400/5 text-rose-300" : "border-white/10 bg-white/5 text-slate-400"}`}>
          <span className={`size-1.5 rounded-full ${health === "ok" ? "bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" : health === "down" ? "bg-rose-300" : "bg-slate-400"}`} />
          {health === "ok" ? `Connected · ${serviceName}` : health === "down" ? "Backend offline" : "Checking API"}
        </div>
        <button className="rounded-lg p-2 text-slate-400 md:hidden" aria-label="More options" type="button" onClick={() => setMobileNav(true)}>
          <MoreHorizontal />
        </button>
      </header>

      <div className="relative mx-auto flex max-w-[1500px]">
        {mobileNav && (
          <button className="fixed inset-0 z-10 bg-black/45 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation" type="button" />
        )}
        <aside className={`${mobileNav ? "block" : "hidden"} absolute inset-y-0 left-0 z-20 w-64 overflow-auto border-r border-white/[0.07] bg-[#0d1018] px-3 py-5 shadow-2xl shadow-black/30 lg:relative lg:block lg:max-h-[calc(100vh-4rem)] lg:bg-transparent lg:shadow-none`}>
          <div className="mb-5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Workspace</div>
          <nav className="flex flex-col gap-1" aria-label="Analysis modes">
            {MODES.map(({ id, label, icon: Icon, group: itemGroup }) => {
              const showGroup = itemGroup === "Interpret" && group !== "Interpret";
              group = itemGroup;
              return (
                <div key={id}>
                  {showGroup && <div className="mb-2 mt-5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Interpret</div>}
                  <button
                    type="button"
                    onClick={() => {
                      if (id === "ask") {
                        setChatOpen(true);
                        setMobileNav(false);
                        return;
                      }
                      setMode(id);
                      setMobileNav(false);
                    }}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${id === "ask" ? (chatOpen ? "bg-violet-400/15 text-violet-100" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200") : mode === id ? "bg-cyan-300/10 text-cyan-200 shadow-[inset_2px_0_0_#67e8f9]" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}
                  >
                    <Icon className={`size-4 ${id === "ask" ? (chatOpen ? "text-violet-300" : "text-slate-500 group-hover:text-slate-300") : mode === id ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`} />
                    {label}
                    {id === "ask" && <span className="ml-auto rounded-md bg-violet-400/15 px-1.5 py-0.5 text-[10px] text-violet-300">ASK</span>}
                  </button>
                </div>
              );
            })}
          </nav>
          <div className="my-6 h-px bg-white/[0.06]" />
          <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Current asset</div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300">
                <ImageIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{fileName ?? "No image yet"}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {metadata ? `${metadata.width} × ${metadata.height} · ${formatBytes(metadata.file_size_bytes)}` : "JPEG, PNG, or WebP"}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
              <span>{metadata ? `${metadata.color_space} · ${metadata.dtype}` : "Up to 10 MB"}</span>
              <span className={metadata ? "text-emerald-300" : "text-slate-500"}>{busy ? "Running" : metadata ? "Ready" : "Waiting"}</span>
            </div>
          </div>
          <label
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-xs text-slate-500 transition hover:border-cyan-300/30 hover:text-cyan-200"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) onUpload(file);
            }}
          >
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.target.value = "";
              }}
            />
            <Upload className="size-3.5" />
            {metadata ? "Replace image" : "Drop an image"}
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] text-slate-300 hover:bg-white/[0.06]" type="button" onClick={() => onSample("/samples/lab-geometry.png", "lab-geometry.png")}>
              Geometry
            </button>
            <button className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] text-slate-300 hover:bg-white/[0.06]" type="button" onClick={() => onSample("/samples/lab-text.png", "lab-text.png")}>
              Text card
            </button>
          </div>
          <button className="mt-2 w-full rounded-xl px-2 py-2 text-[11px] text-slate-500 hover:text-slate-300 disabled:opacity-40" type="button" onClick={onClear} disabled={!metadata}>
            Clear workspace
          </button>
          <div className="mt-8 hidden lg:block">
            <div className="rounded-xl border border-violet-400/15 bg-gradient-to-br from-violet-400/10 to-cyan-400/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-violet-200">
                <CircleHelp className="size-3.5" />
                Session only
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">Images stay in server memory for this session and are not written to disk.</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                <span>Workspace</span>
                <span className="text-slate-700">/</span>
                <span className="text-cyan-300">{active.label}</span>
              </div>
              <h1 className="pixel-title text-2xl font-semibold tracking-tight sm:text-3xl">Visual intelligence, decoded.</h1>
              <p className="mt-2 text-sm text-slate-400">Inspect your image through multiple computer vision lenses.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-40"
                type="button"
                onClick={onExport}
                disabled={!canExport}
              >
                <Download className="size-3.5" />
                Export view
              </button>
              <button
                type="button"
                onClick={() => setChatOpen((open) => !open)}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${chatOpen ? "border-violet-300/50 bg-[#1d192d] text-violet-100" : "border-violet-300/25 bg-[#161421] text-violet-100 hover:border-violet-300/50 hover:bg-[#1d192d]"}`}
                aria-expanded={chatOpen}
                title="Open the assistant (Ctrl+K)"
              >
                <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-violet-300 to-cyan-300 text-slate-950">
                  <Bot className="size-3.5" />
                </span>
                Ask PixelPilot
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {stats.map((stat) => (
              <Stat key={stat.label} {...stat} />
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(330px,0.8fr)]">
            <div className="pixel-card overflow-hidden rounded-2xl shadow-2xl shadow-black/20">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">{active.label === "Overview" ? "Image preview" : active.label}</div>
                  {modelChip && (
                    <div className="flex items-center gap-1.5 rounded-md bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-300">
                      <span className="size-1.5 rounded-full bg-cyan-300" />
                      {modelChip}
                    </div>
                  )}
                </div>
              </div>
              <div className="stage-slot bg-[#151923]" aria-busy={busy}>
                {stage}
              </div>
            </div>
            <div className="pixel-card flex max-h-[calc(100vh-28rem)] flex-col overflow-auto rounded-2xl">{tools}</div>
          </div>
        </section>
      </div>

      {chatOpen && <AskFloat onClose={() => setChatOpen(false)} />}
    </main>
  );
}

function Stat({ label, value, detail, icon: Icon, accent }: ShellStat) {
  const tone = accent === "cyan" ? "text-cyan-300" : accent === "violet" ? "text-violet-300" : accent === "amber" ? "text-amber-300" : "text-emerald-300";
  return (
    <div className="pixel-card pixel-stat rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{label}</span>
        <Icon className={`size-4 ${tone}`} />
      </div>
      <div className="text-2xl font-semibold tracking-tight text-white">{value}</div>
      <div className={`mt-1 text-[10px] ${tone}`}>{detail}</div>
    </div>
  );
}
