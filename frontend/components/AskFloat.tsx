"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { useWorkspace } from "./context";

const PROMPTS = [
  "What is visible in this image?",
  "Is there readable text? If you cannot read it, say so.",
  "Describe the lighting and the background.",
];

type ChatLine = { id: string; role: "user" | "assistant"; text: string; note?: string };

type AskFloatProps = {
  onClose: () => void;
};

export function AskFloat({ onClose }: AskFloatProps) {
  const workspace = useWorkspace();
  const panelRef = useRef<HTMLElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [question, setQuestion] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const width = 380;
    const height = 520;
    setPos({
      x: Math.max(12, window.innerWidth - width - 28),
      y: Math.max(12, window.innerHeight - height - 96),
    });
  }, []);

  useEffect(() => {
    const vision = workspace.vision;
    if (!vision || seen.current.has(vision.request_id)) return;
    seen.current.add(vision.request_id);
    setLines((current) => [
      ...current,
      {
        id: vision.request_id,
        role: "assistant",
        text: vision.answer,
        note: vision.note,
      },
    ]);
  }, [workspace.vision]);

  const asking = workspace.busy && workspace.activity.label === "Vision question";
  const vlmOff = workspace.capabilities?.vlm.configured === false;

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [lines, asking, workspace.error]);

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function onPointerDown(event: React.PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button, input, textarea")) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const startWidth = rect.width;
    const startHeight = rect.height;
    function move(ev: PointerEvent) {
      const width = panelRef.current?.offsetWidth ?? startWidth;
      const height = panelRef.current?.offsetHeight ?? startHeight;
      setPos({
        x: clamp(ev.clientX - offsetX, 8, window.innerWidth - width - 8),
        y: clamp(ev.clientY - offsetY, 8, window.innerHeight - height - 8),
      });
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function send(text: string) {
    const next = text.trim();
    if (!next || workspace.busy || !workspace.metadata) return;
    setLines((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: next }]);
    setQuestion("");
    await workspace.ask(next);
  }

  return (
    <section
      ref={panelRef}
      className="fixed z-40 flex h-[min(520px,calc(100vh-2rem))] w-[min(380px,calc(100vw-1.5rem))] cursor-grab flex-col overflow-hidden rounded-2xl border border-violet-400/25 bg-[#11131d]/95 shadow-2xl shadow-black/50 backdrop-blur-xl active:cursor-grabbing"
      style={pos ? { left: pos.x, top: pos.y } : { right: 24, bottom: 96 }}
      role="dialog"
      aria-label="Ask PixelPilot"
      onPointerDown={onPointerDown}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="grid size-7 place-items-center rounded-lg bg-violet-400/15 text-violet-300">
            <Bot className="size-4" />
          </span>
          Ask PixelPilot
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200" aria-label="Close assistant">
          <X className="size-4" />
        </button>
      </header>

      <div ref={threadRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4">
        <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white/[0.06] px-3 py-2.5 text-xs leading-relaxed text-slate-300">
          Ask about the picture on the stage. Drag the box to move it. The answer is a model reading, and it is not marked verified.
        </div>
        {lines.map((line) =>
          line.role === "user" ? (
            <div key={line.id} className="ml-auto max-w-[92%] break-words rounded-2xl rounded-br-md bg-cyan-300 px-3 py-2.5 text-xs font-medium text-slate-950">
              {line.text}
            </div>
          ) : (
            <div key={line.id} className="max-w-[92%] break-words rounded-2xl rounded-bl-md bg-white/[0.06] px-3 py-2.5 text-xs leading-relaxed text-slate-200">
              <p>{line.text}</p>
              {line.note && <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{line.note}</p>}
            </div>
          ),
        )}
        {asking && <p className="text-[11px] text-violet-300">Reading the image…</p>}
        {workspace.activity.state === "error" && workspace.activity.label === "Vision question" && workspace.error && (
          <p className="text-[11px] text-rose-300">{workspace.error}</p>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.08] p-3">
        <div className="mb-2 flex gap-1.5 overflow-x-auto">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-left text-[10px] whitespace-nowrap text-slate-400 hover:border-violet-300/30 hover:text-violet-200"
              onClick={() => setQuestion(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        {!workspace.metadata && <p className="mb-2 text-[11px] text-slate-500">Load an image first. The question is sent with that picture.</p>}
        {vlmOff && <p className="mb-2 text-[11px] text-slate-500">{workspace.capabilities?.vlm.reason}</p>}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(question);
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about this image..."
            maxLength={1000}
            className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
            aria-label="Ask PixelPilot a question"
          />
          <button
            type="submit"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send question"
            disabled={!question.trim() || workspace.busy || !workspace.metadata || vlmOff}
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </section>
  );
}
