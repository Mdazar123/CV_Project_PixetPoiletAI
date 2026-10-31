'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  Crop,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Gauge,
  GitCompareArrows,
  ImageIcon,
  Layers3,
  Maximize2,
  Menu,
  MoreHorizontal,
  MousePointer2,
  ScanSearch,
  Send,
  Settings2,
  Sparkles,
  Upload,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'

const operations = [
  { label: 'Overview', icon: Activity },
  { label: 'Image Lab', icon: WandSparkles },
  { label: 'Detection', icon: ScanSearch },
  { label: 'Segmentation', icon: Layers3 },
  { label: 'OCR', icon: FileText },
  { label: 'Assistant', icon: Bot },
]

const detections = [
  { label: 'Laptop', score: '98.4%', color: 'bg-cyan-400', x: '17%', y: '30%', w: '48%', h: '45%' },
  { label: 'Coffee cup', score: '94.1%', color: 'bg-violet-400', x: '69%', y: '55%', w: '17%', h: '24%' },
  { label: 'Book', score: '88.6%', color: 'bg-amber-300', x: '36%', y: '75%', w: '24%', h: '13%' },
]

export function PixelPilotWorkbench() {
  const [active, setActive] = useState('Overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setChatOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const ask = () => {
    if (!question.trim()) return
    setSent(true)
    setQuestion('')
    window.setTimeout(() => setSent(false), 2600)
  }

  return (
    <main className="pixel-grid min-h-screen bg-[#0a0c12] text-slate-100 selection:bg-cyan-300 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-70">
        <div className="absolute -left-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-cyan-500/10 blur-[130px]" />
        <div className="absolute -right-32 top-1/3 h-[30rem] w-[30rem] rounded-full bg-violet-600/10 blur-[130px]" />
      </div>

      <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#0a0c12]/85 px-5 backdrop-blur-xl lg:px-7">
        <div className="flex items-center gap-3">
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu /></button>
          <div className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-cyan-300 to-violet-500 text-slate-950 shadow-[0_0_24px_rgba(103,232,249,.2)]"><Sparkles className="size-4" /></div>
          <div><div className="text-sm font-semibold tracking-wide">PixelPilot <span className="text-cyan-300">AI</span></div><div className="hidden text-[10px] uppercase tracking-[0.2em] text-slate-500 sm:block">Vision workbench</div></div>
        </div>
        <div className="hidden items-center gap-2 md:flex"><div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />All systems operational</div><button className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Settings"><Settings2 className="size-4" /></button><div className="ml-1 grid size-8 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-fuchsia-400 to-cyan-300 text-xs font-bold text-slate-950">JD</div></div>
        <button className="rounded-lg p-2 text-slate-400 md:hidden" aria-label="More options"><MoreHorizontal /></button>
      </header>

      <div className="relative mx-auto flex max-w-[1500px]">
        {mobileNav && <button className="fixed inset-0 z-10 bg-black/45 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
        <aside className={`${mobileNav ? 'block' : 'hidden'} absolute inset-y-0 left-0 z-20 w-64 border-r border-white/[0.07] bg-[#0d1018] px-3 py-5 shadow-2xl shadow-black/30 lg:relative lg:block lg:bg-transparent lg:shadow-none`}>
          <div className="mb-5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Workspace</div>
          <nav className="flex flex-col gap-1">
            {operations.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActive(label); setMobileNav(false) }} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active === label ? 'bg-cyan-300/10 text-cyan-200 shadow-[inset_2px_0_0_#67e8f9]' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}`}><Icon className={`size-4 ${active === label ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-300'}`} />{label}{label === 'Assistant' && <span className="ml-auto rounded-md bg-violet-400/15 px-1.5 py-0.5 text-[10px] text-violet-300">NEW</span>}</button>)}
          </nav>
          <div className="my-6 h-px bg-white/[0.06]" />
          <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Current asset</div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><ImageIcon className="size-4" /></div><div className="min-w-0"><div className="truncate text-xs font-medium">workspace-desk.jpg</div><div className="mt-0.5 text-[10px] text-slate-500">1920 × 1280 · 2.4 MB</div></div></div><div className="mt-3 flex items-center justify-between text-[10px] text-slate-500"><span>RGB · 8-bit</span><span className="text-emerald-300">Ready</span></div></div>
          <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-xs text-slate-500 transition hover:border-cyan-300/30 hover:text-cyan-200"><Upload className="size-3.5" />Replace image</button>
          <div className="mt-auto hidden pt-10 lg:block"><div className="rounded-xl border border-violet-400/15 bg-gradient-to-br from-violet-400/10 to-cyan-400/5 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-violet-200"><CircleHelp className="size-3.5" />Learning mode</div><p className="text-[11px] leading-relaxed text-slate-500">Explore each pipeline step and see how visual models reason.</p></div></div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500"><span>Workspace</span><span className="text-slate-700">/</span><span className="text-cyan-300">Overview</span></div><h1 className="pixel-title text-2xl font-semibold tracking-tight sm:text-3xl">Visual intelligence, decoded.</h1><p className="mt-2 text-sm text-slate-400">Inspect your image through multiple computer vision lenses.</p></div><button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-slate-300 transition hover:bg-white/[0.08]"><Download className="size-3.5" />Export session</button></div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Stat label="Objects detected" value="03" detail="+2 from last run" icon={ScanSearch} accent="cyan" /><Stat label="Avg. confidence" value="93.7%" detail="High confidence" icon={Gauge} accent="violet" /><Stat label="Pipeline latency" value="248 ms" detail="18% faster" icon={Zap} accent="amber" /><Stat label="Models active" value="06" detail="Ready to analyze" icon={Activity} accent="emerald" /></div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(330px,0.8fr)]">
            <div className="overflow-hidden pixel-card rounded-2xl shadow-2xl shadow-black/20"><div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5"><div className="flex items-center gap-3"><div className="text-sm font-medium">Detection preview</div><div className="flex items-center gap-1.5 rounded-md bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-300"><span className="size-1.5 rounded-full bg-cyan-300" />YOLOv8 nano</div></div><div className="flex gap-1"><button className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Copy result"><Copy className="size-3.5" /></button><button className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Fullscreen"><Maximize2 className="size-3.5" /></button></div></div><div className="relative aspect-[16/9] overflow-hidden bg-[#151923]"><img src="https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1400&q=85" alt="Laptop on a modern desk" className="h-full w-full object-cover opacity-85" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent" />{detections.map((d) => <div key={d.label} className={`absolute rounded-sm border-2 ${d.color.replace('bg-', 'border-')} shadow-[0_0_14px_rgba(103,232,249,.25)]`} style={{ left: d.x, top: d.y, width: d.w, height: d.h }}><div className={`absolute -top-6 left-[-2px] flex items-center gap-1 rounded-t-sm ${d.color} px-1.5 py-1 text-[10px] font-semibold text-slate-950`}><span>{d.label}</span><span className="opacity-60">{d.score}</span></div></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-3 text-[11px] text-slate-500"><div className="flex items-center gap-4"><span className="flex items-center gap-1.5"><MousePointer2 className="size-3" />Hover a box to inspect</span><span className="hidden items-center gap-1.5 sm:flex"><Clock3 className="size-3" />248ms inference</span></div><button className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200">View raw output <ArrowUpRight className="size-3" /></button></div></div>

            <div className="flex flex-col pixel-card rounded-2xl"><div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5"><div><div className="text-sm font-medium">Detected objects</div><div className="mt-1 text-[11px] text-slate-500">3 predictions · confidence ≥ 0.5</div></div><button className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5" aria-label="More"><MoreHorizontal className="size-4" /></button></div><div className="flex flex-1 flex-col gap-1 p-3">{detections.map((item, i) => <div key={item.label} className="group flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-white/[0.04]"><div className={`grid size-9 place-items-center rounded-lg ${item.color}/10 text-xs font-semibold ${item.color.replace('bg-', 'text-')}`}>0{i + 1}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between text-xs"><span className="font-medium text-slate-200">{item.label}</span><span className="font-mono text-[11px] text-slate-400">{item.score}</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${item.color}`} style={{ width: item.score }} /></div></div><ChevronDown className="size-3.5 -rotate-90 text-slate-600 transition group-hover:text-slate-300" /></div>)}<div className="mt-auto rounded-xl bg-white/[0.025] p-3"><div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400"><Code2 className="size-3.5 text-violet-300" />Inference config</div><div className="grid grid-cols-2 gap-y-2 font-mono text-[10px] text-slate-500"><span>confidence</span><span className="text-right text-slate-300">0.50</span><span>image size</span><span className="text-right text-slate-300">640 × 640</span><span>device</span><span className="text-right text-emerald-300">CPU · ready</span></div></div></div></div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="pixel-card rounded-2xl p-5"><div className="mb-5 flex items-start justify-between"><div><div className="flex items-center gap-2 text-sm font-medium"><GitCompareArrows className="size-4 text-violet-300" />Analysis pipeline</div><p className="mt-1 text-[11px] text-slate-500">A transparent look at each transformation.</p></div><button className="text-[11px] text-slate-500 hover:text-slate-200">Configure <Settings2 className="ml-1 inline size-3" /></button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Input','Original','cyan'],['Preprocess','RGB → tensor','violet'],['Inference','YOLOv8 nano','amber'],['Output','3 objects','emerald']].map(([a,b,c], i) => <div key={a} className="relative rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">{i < 3 && <div className="absolute -right-3 top-1/2 hidden h-px w-3 bg-white/10 sm:block" />}<div className={`mb-3 size-2 rounded-full ${c === 'cyan' ? 'bg-cyan-300' : c === 'violet' ? 'bg-violet-300' : c === 'amber' ? 'bg-amber-300' : 'bg-emerald-300'} shadow-[0_0_10px_currentColor]`} /><div className="text-[10px] uppercase tracking-wider text-slate-500">{a}</div><div className="mt-1 truncate text-xs font-medium text-slate-200">{b}</div></div>)}</div></div><div className="rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-400/[0.11] via-[#11131d] to-cyan-400/[0.06] p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-medium"><Bot className="size-4 text-violet-300" />Ask PixelPilot</div><span className="rounded-md border border-violet-300/20 px-2 py-1 text-[10px] text-violet-300">BETA</span></div><p className="mb-4 text-xs leading-relaxed text-slate-400">I can explain the detections, compare models, or help you choose the right approach.</p><div className="mb-3 flex flex-wrap gap-1.5">{['Why is confidence high?', 'Explain this pipeline'].map((q) => <button key={q} onClick={() => setQuestion(q)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] text-slate-400 hover:border-violet-300/30 hover:text-violet-200">{q}</button>)}</div><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-1.5"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) ask() }} placeholder="Ask about this image..." className="min-w-0 flex-1 bg-transparent px-2 text-xs text-slate-200 outline-none placeholder:text-slate-600" /><button onClick={ask} className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-400 text-slate-950 transition hover:bg-violet-300" aria-label="Send question">{sent ? <Check className="size-3.5" /> : <Send className="size-3.5" />}</button></div></div></div>
        </section>
      </div>

      <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        {chatOpen && <section className="w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-violet-400/20 bg-[#11131d]/95 shadow-2xl shadow-black/40 backdrop-blur-xl" aria-label="PixelPilot assistant">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium"><span className="grid size-7 place-items-center rounded-lg bg-violet-400/15 text-violet-300"><Bot className="size-4" /></span>Ask PixelPilot</div>
            <button onClick={() => setChatOpen(false)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200" aria-label="Close assistant"><X className="size-4" /></button>
          </div>
          <div className="flex min-h-28 flex-col justify-end gap-3 p-4">
            <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-white/[0.06] px-3 py-2.5 text-xs leading-relaxed text-slate-300">I can explain detections, compare models, or help you choose the right approach.</div>
            {sent && <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-cyan-300 px-3 py-2.5 text-xs font-medium text-slate-950">Got it — I&apos;ll analyze that for you.</div>}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); ask() }} className="flex gap-2 border-t border-white/[0.08] p-3">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this image..." className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40" aria-label="Ask PixelPilot a question" />
            <button type="submit" className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send question" disabled={!question.trim()}><Send className="size-4" /></button>
          </form>
        </section>}
        <button onClick={() => setChatOpen((open) => !open)} className="group flex items-center gap-2 rounded-full border border-violet-300/25 bg-[#161421] px-4 py-3 text-xs font-semibold text-violet-100 shadow-xl shadow-violet-950/30 transition hover:-translate-y-0.5 hover:border-violet-300/50 hover:bg-[#1d192d]" aria-expanded={chatOpen} aria-controls="pixelpilot-assistant" title="Open PixelPilot assistant (⌘K / Ctrl+K)"><span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-violet-300 to-cyan-300 text-slate-950"><Bot className="size-4" /></span><span className="hidden sm:inline">Ask PixelPilot</span><span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" /></button>
      </div>
    </main>
  )
}

function Stat({ label, value, detail, icon: Icon, accent }: { label: string; value: string; detail: string; icon: typeof Activity; accent: string }) {
  const tone = accent === 'cyan' ? 'text-cyan-300' : accent === 'violet' ? 'text-violet-300' : accent === 'amber' ? 'text-amber-300' : 'text-emerald-300'
  return <div className="pixel-card pixel-stat rounded-2xl p-4"><div className="mb-4 flex items-center justify-between"><span className="text-[11px] text-slate-500">{label}</span><Icon className={`size-4 ${tone}`} /></div><div className="text-2xl font-semibold tracking-tight text-white">{value}</div><div className={`mt-1 text-[10px] ${tone}`}>{detail}</div></div>
}
