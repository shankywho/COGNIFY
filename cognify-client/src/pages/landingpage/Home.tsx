import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import {
  ArrowRight,
  Check,
  Copy,
  Cpu,
  Database,
  FileCode,
  GitBranch,
  Layers,
  LineChart,
  Lock,
  Play,
  RotateCw,
  Search,
  Shield,
  Terminal,
  Workflow,
  Zap,
  Menu,
  X,
  ExternalLink,
  Code2,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/button";
import { Logo } from "@/components/logo";

const useAuthTarget = () => {
  const [target, setTarget] = useState("/sign-in");
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      setTarget("/dashboard/chat");
    }
  }, []);
  return target;
};

export default function Home() {
  return (
    <ReactLenis root>
      <div className="min-h-screen bg-black text-white selection:bg-white/20 selection:text-white antialiased">
        <Nav />
        <Hero />
        <EcosystemTicker />
        <EngineeringInvariants />
        <ArchitectureSection />
        <FeatureMultiAgent />
        <FeatureMemory />
        <FeatureMonitoring />
        <CTA />
        <Footer />
      </div>
    </ReactLenis>
  );
}

/* ----------------------------- NAV ----------------------------- */
export function Nav() {
  const startHref = useAuthTarget();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Logo size={28} />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {[
              { label: "Architecture", href: "#architecture" },
              { label: "Agents", href: "#agents" },
              { label: "Vector Memory", href: "#memory" },
              { label: "Observability", href: "#observability" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[13px] font-medium text-zinc-400 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/sign-in"
            className="hidden sm:inline-flex text-[13px] font-medium text-zinc-400 transition-colors hover:text-white"
          >
            Sign In
          </Link>
          <Button
            as={Link}
            to={startHref}
            size="sm"
            variant="primary"
            className="whitespace-nowrap inline-flex items-center justify-center gap-2"
          >
            Start Building
            <ArrowRight className="size-3.5 shrink-0 ml-1" />
          </Button>

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex md:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 top-14 z-40 bg-black/95 backdrop-blur-2xl md:hidden border-b border-white/10">
          <nav className="flex flex-col p-6 space-y-4 text-left" aria-label="Mobile">
            {[
              { label: "Architecture", href: "#architecture" },
              { label: "Agents", href: "#agents" },
              { label: "Vector Memory", href: "#memory" },
              { label: "Observability", href: "#observability" },
              { label: "Pricing Plans", href: "/pricing", isRoute: true },
              { label: "About Cognify", href: "/about", isRoute: true },
            ].map((item) => (
              item.isRoute ? (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-base font-medium text-zinc-300 hover:text-white border-b border-white/5 pb-3 transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-base font-medium text-zinc-300 hover:text-white border-b border-white/5 pb-3 transition-colors"
                >
                  {item.label}
                </a>
              )
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <Link
                to="/sign-in"
                onClick={() => setMobileOpen(false)}
                className="w-full py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-center text-sm font-semibold text-white"
              >
                Sign In
              </Link>
              <Link
                to={startHref}
                onClick={() => setMobileOpen(false)}
                className="w-full py-2.5 rounded-xl bg-white text-center text-sm font-semibold !text-black shadow-sm"
              >
                Start Building Free →
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ----------------------------- HERO ----------------------------- */
function Hero() {
  const startHref = useAuthTarget();
  const [copiedQuickstart, setCopiedQuickstart] = useState(false);

  const handleCopyQuickstart = () => {
    navigator.clipboard.writeText("git clone https://github.com/shankywho/COGNIFY && npm run docker:up");
    setCopiedQuickstart(true);
    setTimeout(() => setCopiedQuickstart(false), 2500);
  };

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-black pt-16 pb-20 md:pt-24 md:pb-28">
      {/* High-end monochromatic atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-25 mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08)_0%,_transparent_65%)]" />
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Hero Left Column */}
          <div className="lg:col-span-6 text-left">
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl leading-[1.06]">
              Orchestrate autonomous{" "}
              <span className="text-zinc-100 underline decoration-zinc-700 decoration-1 underline-offset-8">
                AI pipelines
              </span>{" "}
              at scale.
            </h1>

            <p className="mt-5 max-w-xl text-pretty text-base md:text-lg text-zinc-400 leading-relaxed font-normal">
              Cognify combines a visual DAG canvas, isolated BullMQ worker pools, hybrid vector memory, and self-healing LLM circuit breakers into a unified production runtime.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Button
                as={Link}
                to={startHref}
                size="lg"
                variant="primary"
                className="whitespace-nowrap inline-flex items-center justify-center gap-2"
              >
                Start Building Free
                <ArrowRight className="size-4 shrink-0 ml-1" />
              </Button>
              <Button as="a" href="#demo" size="lg" variant="secondary" leftIcon={<Play className="size-3.5 fill-current" />}>
                View Live DAG
              </Button>
            </div>

            {/* 1-Line Developer Quickstart */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/90 px-3.5 py-2 font-mono text-[11px] text-zinc-300 shadow-inner max-w-full overflow-hidden">
                <Terminal className="size-3.5 text-zinc-500 shrink-0" />
                <span className="truncate select-all text-zinc-300">
                  git clone https://github.com/shankywho/COGNIFY && npm run docker:up
                </span>
                <button
                  type="button"
                  onClick={handleCopyQuickstart}
                  className="ml-1 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0 p-1"
                  title="Copy command"
                  aria-label="Copy quickstart command"
                >
                  {copiedQuickstart ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>

            {/* Core Architectural Invariants */}
            <div className="mt-9 grid grid-cols-2 gap-y-2.5 gap-x-4 text-[12px] font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-white shrink-0" />
                <span>Topological DAG Ordering</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-white shrink-0" />
                <span>Hybrid pgvector + tsvector</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-white shrink-0" />
                <span>O(1) Atomic Credit Ledger</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-white shrink-0" />
                <span>Multi-Pod Socket Telemetry</span>
              </div>
            </div>
          </div>

          {/* Hero Right Column: Interactive Visual */}
          <div className="lg:col-span-6" id="demo">
            <WorkflowVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- SUPPORTED ECOSYSTEM TICKER ----------------------------- */
function EcosystemTicker() {
  const items = [
    { name: "Claude 3.5 Sonnet", type: "Anthropic LLM" },
    { name: "GPT-4o & o1", type: "OpenAI LLM" },
    { name: "Llama 3.3 70B", type: "Groq LPU" },
    { name: "DeepSeek V3", type: "Reasoning LLM" },
    { name: "pgvector 1536d", type: "Vector Memory" },
    { name: "Redis 7 & BullMQ", type: "Distributed Queue" },
    { name: "Docker & PM2", type: "Self-Hosted" },
    { name: "Stripe & Razorpay", type: "Billing Webhooks" },
  ];

  return (
    <div className="border-b border-white/10 bg-black/60 py-4 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-left">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-zinc-400 shrink-0">
            Runtime & Model Ecosystem
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {items.map((item) => (
              <span
                key={item.name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border border-white/10 bg-zinc-900/60 text-zinc-300 hover:border-white/20 transition-colors"
              >
                <span className="size-1.5 rounded-full bg-white/60" />
                <span className="text-white font-medium">{item.name}</span>
                <span className="text-zinc-500 text-[10px]">({item.type})</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- WORKFLOW VISUAL ----------------------------- */
const SEEDED_WORKFLOWS = [
  {
    id: "support-triage",
    label: "Support Triage",
    file: "workspace / support-triage-mesh.dag",
    nodes: [
      { id: "trigger", x: "18px", y: "35px", kind: "Trigger", name: "Inbound Webhook", latency: "8ms" },
      { id: "classifier", x: "170px", y: "115px", kind: "Agent", name: "Intent Classifier", latency: "142ms" },
      { id: "memory", x: "330px", y: "35px", kind: "Memory", name: "Hybrid RAG Search", latency: "38ms" },
      { id: "action", x: "330px", y: "195px", kind: "Action", name: "Action Executor", latency: "214ms" },
    ],
    logs: [
      { t: "14:20:01.102", k: "TRIGGER", v: "> incoming support ticket #4819" },
      { t: "14:20:01.244", k: "CLASSIFIER", v: "> intent: billing_dispute (confidence: 0.98)" },
      { t: "14:20:01.282", k: "RAG_SEARCH", v: "> retrieved 3 policy chunks via RRF (38ms)" },
      { t: "14:20:01.496", k: "DECISION", v: "> dispatched action to downstream webhook" },
      { t: "14:20:01.520", k: "COMPLETED", v: "> run_8f29 finished in 402ms (1 cached step)" },
    ],
  },
  {
    id: "grounded-rag",
    label: "Grounded RAG",
    file: "workspace / grounded-rag-pipeline.dag",
    nodes: [
      { id: "trigger", x: "18px", y: "35px", kind: "Trigger", name: "Doc Ingest Event", latency: "4ms" },
      { id: "classifier", x: "170px", y: "115px", kind: "Transform", name: "Semantic Chunker", latency: "88ms" },
      { id: "memory", x: "330px", y: "35px", kind: "Embed", name: "pgvector 1536d", latency: "164ms" },
      { id: "action", x: "330px", y: "195px", kind: "Store", name: "HNSW Knowledge Index", latency: "52ms" },
    ],
    logs: [
      { t: "10:14:02.010", k: "TRIGGER", v: "> s3://docs/q4_architecture.pdf detected" },
      { t: "10:14:02.098", k: "CHUNKER", v: "> extracted 42 chunks (size: 512, overlap: 64)" },
      { t: "10:14:02.262", k: "EMBEDDER", v: "> text-embedding-3-small generated 1536d vectors" },
      { t: "10:14:02.314", k: "INDEXER", v: "> HNSW index updated (SQL isolation enforced)" },
      { t: "10:14:02.330", k: "COMPLETED", v: "> doc ingest completed in 308ms" },
    ],
  },
  {
    id: "pr-reviewer",
    label: "PR Reviewer",
    file: "workspace / automated-code-pr-reviewer.dag",
    nodes: [
      { id: "trigger", x: "18px", y: "35px", kind: "Trigger", name: "GitHub Webhook", latency: "12ms" },
      { id: "classifier", x: "170px", y: "115px", kind: "Agent", name: "AST Diff Extractor", latency: "96ms" },
      { id: "memory", x: "330px", y: "35px", kind: "Security", name: "Circuit Breaker Linter", latency: "74ms" },
      { id: "action", x: "330px", y: "195px", kind: "Dispatch", name: "PR Comment Dispatch", latency: "182ms" },
    ],
    logs: [
      { t: "16:45:10.012", k: "TRIGGER", v: "> pull_request.opened #142 (repo: core-api)" },
      { t: "16:45:10.108", k: "DIFF", v: "> parsed diff: +184 lines across 4 files" },
      { t: "16:45:10.182", k: "LINTER", v: "> verified LLMGateway circuit breaker patterns" },
      { t: "16:45:10.364", k: "DISPATCH", v: "> posted review summary to GitHub PR #142" },
      { t: "16:45:10.380", k: "COMPLETED", v: "> automated review finished in 364ms" },
    ],
  },
];

function WorkflowVisual() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeStep, setActiveStep] = useState(4); // 0=none, 1=node0, 2=node1, 3=node2, 4=all
  const [isSimulating, setIsSimulating] = useState(false);
  const [throughput, setThroughput] = useState(2481);

  const currentWf = SEEDED_WORKFLOWS[selectedIdx];

  const handleSimulate = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setActiveStep(0);

    const stepDuration = 320;
    setTimeout(() => setActiveStep(1), stepDuration);
    setTimeout(() => setActiveStep(2), stepDuration * 2);
    setTimeout(() => setActiveStep(3), stepDuration * 3);
    setTimeout(() => setActiveStep(4), stepDuration * 4);
    setTimeout(() => {
      setIsSimulating(false);
      setThroughput((prev) => prev + 1);
    }, stepDuration * 5);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-2xl backdrop-blur-md">
      {/* Visual Window Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-zinc-900/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-zinc-700" />
            <span className="size-2 rounded-full bg-zinc-700" />
            <span className="size-2 rounded-full bg-zinc-700" />
          </div>
          <span className="font-mono text-[10.5px] text-zinc-400">
            {currentWf.file}
          </span>
        </div>

        {/* 3-Tab Seeded Workflow Switcher */}
        <div className="flex items-center rounded-lg border border-white/10 bg-black/60 p-0.5 font-mono text-[10px]">
          {SEEDED_WORKFLOWS.map((wf, idx) => (
            <button
              key={wf.id}
              type="button"
              onClick={() => {
                setSelectedIdx(idx);
                setActiveStep(4);
              }}
              className={`rounded-md px-2 py-1 transition-all cursor-pointer ${
                selectedIdx === idx
                  ? "bg-white !text-black font-semibold shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {wf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-header Controls Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-2 font-mono text-[10.5px]">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-zinc-300">DAG Runtime: Ready</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">{throughput.toLocaleString()} runs processed</span>
        </div>

        <button
          type="button"
          onClick={handleSimulate}
          disabled={isSimulating}
          className="whitespace-nowrap inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 hover:bg-white/10 px-2.5 py-1 font-mono text-[10.5px] font-medium text-white transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isSimulating ? (
            <>
              <RotateCw className="size-3 animate-spin text-white" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Play className="size-2.5 fill-current text-white" />
              <span>Simulate Run</span>
            </>
          )}
        </button>
      </div>

      {/* Interactive Visual Canvas with Responsive Wrapper */}
      <div className="relative h-[290px] grid-bg overflow-x-auto overflow-y-hidden bg-black/60 scrollbar-none">
        <div className="relative w-[480px] sm:w-full h-full">
          {/* SVG Bezier Curves with Animated Flow */}
          <svg className="absolute inset-0 size-full pointer-events-none" viewBox="0 0 480 280">
            <defs>
              <filter id="beamGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Base wires */}
            <path
              d="M 120 65 C 145 65, 150 145, 175 145"
              fill="none"
              stroke={activeStep >= 1 ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.15)"}
              strokeWidth="1.5"
            />
            <path
              d="M 270 145 C 295 145, 305 65, 330 65"
              fill="none"
              stroke={activeStep >= 2 ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.15)"}
              strokeWidth="1.5"
            />
            <path
              d="M 270 145 C 295 145, 305 225, 330 225"
              fill="none"
              stroke={activeStep >= 3 ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.15)"}
              strokeWidth="1.5"
            />

            {/* Animated Energy Flow Beams */}
            {isSimulating && activeStep === 1 && (
              <circle r="3.5" fill="#ffffff" filter="url(#beamGlow)">
                <animateMotion dur="0.32s" repeatCount="1" path="M 120 65 C 145 65, 150 145, 175 145" />
              </circle>
            )}
            {isSimulating && (activeStep === 2 || activeStep === 3) && (
              <>
                <circle r="3.5" fill="#ffffff" filter="url(#beamGlow)">
                  <animateMotion dur="0.32s" repeatCount="1" path="M 270 145 C 295 145, 305 65, 330 65" />
                </circle>
                <circle r="3.5" fill="#ffffff" filter="url(#beamGlow)">
                  <animateMotion dur="0.32s" repeatCount="1" path="M 270 145 C 295 145, 305 225, 330 225" />
                </circle>
              </>
            )}
          </svg>

          {/* Nodes */}
          {currentWf.nodes.map((node, i) => {
            let status: "pending" | "busy" | "done" = "pending";
            if (activeStep > i) status = "done";
            else if (activeStep === i && isSimulating) status = "busy";
            else if (activeStep === 4) status = "done";

            return (
              <Node
                key={`${currentWf.id}-${node.id}`}
                style={{ left: node.x, top: node.y }}
                kind={node.kind}
                name={node.name}
                latency={status === "done" ? node.latency : undefined}
                status={status}
              />
            );
          })}
        </div>
      </div>

      {/* Mini Streaming Logs Footer */}
      <div className="border-t border-white/10 bg-black/80 px-4 py-2 font-mono text-[10px] text-zinc-400">
        <div className="flex items-center justify-between text-zinc-500 mb-1">
          <span className="uppercase tracking-wider text-[9px]">Execution Trace Log</span>
          <span>Buffer: Synced</span>
        </div>
        <div className="space-y-0.5 truncate text-left">
          {currentWf.logs.slice(0, activeStep === 4 ? 3 : Math.max(1, activeStep)).map((l, idx) => (
            <div key={idx} className="truncate">
              <span className="text-zinc-500">[{l.t}]</span>{" "}
              <span className="text-zinc-300 font-semibold">{l.k}:</span>{" "}
              <span className="text-zinc-400">{l.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Node({
  style,
  kind,
  name,
  latency,
  status = "done",
}: {
  style: React.CSSProperties;
  kind: string;
  name: string;
  latency?: string;
  status?: "pending" | "busy" | "done";
}) {
  return (
    <div
      style={style}
      className={`absolute w-32 rounded-xl border p-2 transition-all shadow-lg text-left ${
        status === "busy"
          ? "border-white bg-white/15 ring-2 ring-white/50 animate-pulse"
          : status === "done"
            ? "border-white/20 bg-zinc-950/90 hover:border-white/40"
            : "border-zinc-800 bg-zinc-950/50 opacity-40"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full ${
              status === "busy"
                ? "bg-white animate-pulse"
                : status === "done"
                  ? "bg-white"
                  : "bg-zinc-600"
            }`}
          />
          <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-400">
            {kind}
          </span>
        </div>
        <span
          className={`font-mono text-[8.5px] uppercase px-1.5 py-0.25 rounded border ${
            status === "busy"
              ? "border-white bg-white !text-black font-semibold"
              : status === "done"
                ? "border-white/20 bg-white/5 text-zinc-300"
                : "border-zinc-800 bg-zinc-900 text-zinc-500"
          }`}
        >
          {status === "done" ? latency || "DONE" : status}
        </span>
      </div>
      <div className="mt-1 text-[11px] font-semibold text-white tracking-tight truncate">
        {name}
      </div>
    </div>
  );
}

/* ----------------------------- ENGINEERING INVARIANTS STRIP ----------------------------- */
function EngineeringInvariants() {
  const metrics = [
    { label: "Sub-Second P95", value: "< 45ms", sub: "Groq LPU + Redis Cache" },
    { label: "Token Savings", value: "75%+", sub: "Step-Level Replay HIT" },
    { label: "Vector Precision", value: "1536-dim", sub: "pgvector HNSW + RRF" },
    { label: "Atomic Balance Lock", value: "O(1)", sub: "Zero Row Contention" },
    { label: "Breaker Recovery", value: "99.9%", sub: "Automatic 429 Failover" },
    { label: "Production Blueprints", value: "3", sub: "Seeded Golden DAGs" },
  ];

  return (
    <section className="border-b border-white/10 bg-zinc-950/70 py-8">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-y-6 gap-x-4 sm:grid-cols-3 lg:grid-cols-6 text-center">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col items-center">
              <div className="text-2xl font-bold tracking-tight text-white font-mono sm:text-3xl">
                {m.value}
              </div>
              <div className="mt-1 text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-semibold">
                {m.label}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {m.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- ARCHITECTURE COMPARISON ----------------------------- */
function ArchitectureSection() {
  return (
    <section className="border-b border-white/10 bg-black py-20" id="architecture">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5 text-left">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              Engineered For Determinism
            </div>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Deterministic runtime instead of fragile prompt scripts.
            </h2>
            <p className="mt-4 text-pretty text-sm md:text-base leading-relaxed text-zinc-400">
              Moving beyond ad-hoc python scripts requires topological queue sequencing, idempotent webhook settlement, step-level replay, and relational vector memory.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {["Topological DAG Ordering", "75%+ Token Savings on Replay", "SQL-Enforced Multi-Tenancy"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border border-white/10 bg-white/5 text-zinc-300">
                  <Check className="size-3 text-white" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 p-5 shadow-xl text-left">
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-400 mb-3 flex items-center justify-between">
                <span>Infrastructure Comparison</span>
                <span className="text-[10px] text-zinc-500">PRODUCTION INVARIANTS</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-red-950/40 bg-red-950/10 p-3.5">
                  <div className="text-[13px] font-semibold text-zinc-200">
                    Fragile Ad-Hoc Scripts & Celery
                  </div>
                  <div className="mt-1 text-[11.5px] text-zinc-400 leading-relaxed font-sans">
                    Head-of-line queue blocking, unhandled 429 timeouts, cross-workspace vector data leaks, and lost execution states on worker crash.
                  </div>
                </div>

                <div className="rounded-xl border border-white/20 bg-white/5 p-3.5">
                  <div className="flex items-center justify-between text-[13px] font-semibold text-white">
                    <span>Cognify Unified Operations Platform</span>
                    <span className="font-mono text-[9.5px] uppercase px-1.5 py-0.5 rounded border border-white/20 bg-white/10 text-white">Cognify Runtime</span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-zinc-300 leading-relaxed font-sans">
                    Isolated BullMQ worker pools, step-level replay saving 75%+ tokens, SQL-enforced multi-tenancy, and LLM circuit breakers with automatic failover.
                  </div>
                </div>
              </div>

              {/* 4 Technical Invariants Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-4 font-mono text-[11px]">
                <div className="p-2.5 rounded-lg border border-white/5 bg-zinc-900/50">
                  <div className="text-white font-semibold flex items-center gap-1.5">
                    <Workflow className="size-3 text-zinc-400" />
                    Kahn DAG Sort
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Topological resolution with cycle guards</div>
                </div>
                <div className="p-2.5 rounded-lg border border-white/5 bg-zinc-900/50">
                  <div className="text-white font-semibold flex items-center gap-1.5">
                    <Zap className="size-3 text-zinc-400" />
                    O(1) Credit Lock
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Zero table locks via atomic balance guards</div>
                </div>
                <div className="p-2.5 rounded-lg border border-white/5 bg-zinc-900/50">
                  <div className="text-white font-semibold flex items-center gap-1.5">
                    <RotateCw className="size-3 text-zinc-400" />
                    LLM Circuit Breaker
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Sub-second failover on consecutive 429s</div>
                </div>
                <div className="p-2.5 rounded-lg border border-white/5 bg-zinc-900/50">
                  <div className="text-white font-semibold flex items-center gap-1.5">
                    <Lock className="size-3 text-zinc-400" />
                    AES-256-GCM Vault
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Random 12-byte IV envelope encryption</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- SECTION HEADER ----------------------------- */
function SectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="max-w-2xl text-left">
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl leading-[1.1]">
        {title}
      </h2>
      <p className="mt-3 text-pretty text-sm md:text-base leading-relaxed text-zinc-400">
        {desc}
      </p>
    </div>
  );
}

/* ----------------------------- FEATURE MULTI-AGENT ----------------------------- */
function FeatureMultiAgent() {
  const [selectedAgentIdx, setSelectedAgentIdx] = useState(0);

  const agents = [
    {
      name: "Code Reviewer",
      model: "claude-3.5-sonnet",
      task: "PR AST Analysis",
      latency: "1.4s",
      load: 68,
      prompt: "Extract AST diffs, detect memory leaks and race conditions, and generate inline GitHub comments with verified fix patches.",
      tools: ["AST Diff Parser", "Git PR Webhook", "Linter Validator"],
      temperature: 0.2,
      maxTokens: 4096,
    },
    {
      name: "RAG Synthesizer",
      model: "gpt-4o",
      task: "Dense RRF Fusion",
      latency: "840ms",
      load: 52,
      prompt: "Execute Reciprocal Rank Fusion on pgvector embeddings and full-text keywords. Ground responses with strict source citations.",
      tools: ["pgvector 1536d", "BM25 TsVector", "Source Grounding"],
      temperature: 0.3,
      maxTokens: 2048,
    },
    {
      name: "Triage Classifier",
      model: "groq-llama-3.3",
      task: "Intent Matching",
      latency: "48ms",
      load: 24,
      prompt: "Classify incoming payload intent into billing dispute, technical outage, or tier upgrade within 50ms sub-second bounds.",
      tools: ["Sub-50ms Inference", "JSON Schema Output", "Webhook Router"],
      temperature: 0.1,
      maxTokens: 512,
    },
    {
      name: "Security Boundary",
      model: "mesh-guard",
      task: "Injection Defense",
      latency: "14ms",
      load: 12,
      prompt: "Detect prompt injection boundaries, strip malicious XML delimiter tags, and enforce AES-256-GCM credential envelope checks.",
      tools: ["Prompt Shield", "XML Strip Filter", "AES-256-GCM Vault"],
      temperature: 0.0,
      maxTokens: 256,
    },
  ];

  const currentAgent = agents[selectedAgentIdx];

  return (
    <section className="border-b border-white/10 bg-black py-20" id="agents">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 items-center">
        <div className="lg:col-span-5 text-left">
          <SectionHeader
            eyebrow="01 — SPECIALIZED AUTONOMY"
            title="Coordinate specialized agents without infrastructure chaos."
            desc="Every pipeline executes focused agents on optimal LLMs. Cognify enforces topological DAG sequencing, isolated memory boundaries, and step-level retry checkpoints automatically."
          />
          <div className="mt-6 flex flex-wrap gap-2">
            {["Independent Agent Memory", "Dynamic Model Routing", "JSON Schema Validation"].map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border border-white/10 bg-white/5 text-zinc-300">
                <Check className="size-3 text-white" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-5 shadow-2xl text-left">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-300">
                <Layers className="size-3.5 text-white" />
                <span>agent.registry · 4 active worker pods</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500 uppercase">Click Agent To Inspect</span>
            </div>

            {/* 4 Agent Selectable Cards */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {agents.map((a, idx) => {
                const isSelected = selectedAgentIdx === idx;
                return (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => setSelectedAgentIdx(idx)}
                    className={`rounded-xl border p-3.5 transition-all text-left cursor-pointer ${
                      isSelected
                        ? "border-white bg-zinc-900/90 shadow-md ring-1 ring-white/20"
                        : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[13px] font-semibold text-white">{a.name}</div>
                        <div className="font-mono text-[10px] text-zinc-400">{a.model}</div>
                      </div>
                      <span className={`font-mono text-[8.5px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        isSelected
                          ? "border-white bg-white !text-black font-semibold"
                          : "border-white/20 bg-white/5 text-zinc-300"
                      }`}>
                        {isSelected ? "selected" : "active"}
                      </span>
                    </div>

                    <div className="mt-2.5 flex justify-between font-mono text-[10px] text-zinc-400 border-t border-zinc-800/60 pt-2">
                      <span>Task: <span className="text-zinc-200">{a.task}</span></span>
                      <span>{a.latency}</span>
                    </div>

                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full bg-white transition-all duration-500"
                        style={{ width: `${a.load}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Agent Runtime Inspector Panel */}
            <div className="mt-3.5 p-3.5 rounded-xl border border-white/10 bg-black/60 font-mono text-[11px]">
              <div className="flex items-center justify-between text-zinc-400 pb-2 border-b border-zinc-800 text-[10px] uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-white font-semibold">
                  <Sliders className="size-3 text-zinc-400" />
                  {currentAgent.name} Runtime Persona
                </span>
                <span>Temp: {currentAgent.temperature} · MaxTokens: {currentAgent.maxTokens}</span>
              </div>
              <p className="mt-2 text-zinc-300 text-[11.5px] font-sans leading-relaxed">
                "{currentAgent.prompt}"
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {currentAgent.tools.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 inline-flex items-center gap-1">
                    <CheckCircle2 className="size-2.5 text-emerald-400" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- FEATURE MEMORY ----------------------------- */
function FeatureMemory() {
  const MEMORY_QUERIES = [
    {
      id: "refund",
      query: "refund_idempotency_keys",
      label: "Refund Policy & Idempotency",
      results: [
        { title: "enterprise_refund_policy_v2.md", score: "0.96", type: "Cosine <=> RRF", match: "Matches: refund clause, dispute window, and webhook settlement." },
        { title: "idempotency_key_settlement_flow.ts", score: "0.93", type: "BM25 Lexical", match: "Matches: Redis idempotency key settlement and token ledger." },
        { title: "workspace_rbac_audit_trail.sql", score: "0.89", type: "Hybrid Rank", match: "Matches: tenant isolation WHERE workspace_id check." },
      ]
    },
    {
      id: "auth",
      query: "jwt_token_expiry_validation",
      label: "JWT Auth & Edge Verification",
      results: [
        { title: "auth_jwt_validator_middleware.ts", score: "0.98", type: "Cosine <=> RRF", match: "Matches: RSA-256 verify, exp claim validation, clock skew." },
        { title: "redis_session_revocation_store.ts", score: "0.94", type: "BM25 Lexical", match: "Matches: instant session invalidation blacklist." },
        { title: "rate_limiter_auth_endpoints.ts", score: "0.88", type: "Hybrid Rank", match: "Matches: sliding window rate limiter for login routes." },
      ]
    },
    {
      id: "ratelimit",
      query: "redis_sliding_window_limiter",
      label: "Sliding Window Rate Limiter",
      results: [
        { title: "rate_limit_redis_sliding_window.ts", score: "0.97", type: "Cosine <=> RRF", match: "Matches: ZREMRANGEBYSCORE + ZADD atomic pipeline." },
        { title: "token_bucket_backpressure_queue.ts", score: "0.91", type: "BM25 Lexical", match: "Matches: BullMQ queue pause on 503 backpressure." },
        { title: "api_gateway_throttle_policy.yaml", score: "0.86", type: "Hybrid Rank", match: "Matches: per-workspace tier quota boundaries." },
      ]
    }
  ];

  const [activeQueryIdx, setActiveQueryIdx] = useState(0);
  const currentQueryData = MEMORY_QUERIES[activeQueryIdx];

  return (
    <section className="border-b border-white/10 bg-zinc-950/60 py-20" id="memory">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 items-center">
        <div className="lg:order-2 lg:col-span-5 text-left">
          <SectionHeader
            eyebrow="02 — HYBRID VECTOR MEMORY"
            title="Relational vector memory with SQL-enforced isolation."
            desc="Unified PostgreSQL storage with pgvector and full-text search. Reciprocal Rank Fusion (k=60) merges dense semantic similarity with exact sparse keywords under strict WHERE workspace_id boundaries."
          />
          <div className="mt-6 flex flex-wrap gap-2">
            {["1536-dim PostgreSQL Embeddings", "RRF k=60 Fusion", "Zero Cross-Workspace Leakage"].map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border border-white/10 bg-white/5 text-zinc-300">
                <Check className="size-3 text-white" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:order-1 lg:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black p-5 shadow-2xl text-left">
            {/* Interactive Query Selector Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3.5 pb-3 border-b border-zinc-800">
              <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider mr-1">
                Sample Query:
              </span>
              {MEMORY_QUERIES.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setActiveQueryIdx(idx)}
                  className={`px-2.5 py-1 rounded-md font-mono text-[10.5px] transition-all cursor-pointer ${
                    activeQueryIdx === idx
                      ? "bg-white !text-black font-semibold shadow-xs"
                      : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* SQL Terminal Box */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Search className="size-4 text-white shrink-0" />
              <div className="font-mono text-[11px] sm:text-[11.5px] text-zinc-200 truncate">
                <span className="text-zinc-500">SELECT * FROM</span> vector_memory(query=&apos;{currentQueryData.query}&apos;)
              </div>
            </div>

            {/* Ranked Results List */}
            <div className="mt-3.5 space-y-2">
              {currentQueryData.results.map((r) => (
                <div
                  key={r.title}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-zinc-700"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Database className="size-4 text-zinc-400 shrink-0" />
                    <div className="overflow-hidden">
                      <div className="text-[12.5px] font-medium text-white truncate">{r.title}</div>
                      <div className="font-mono text-[9.5px] text-zinc-400 truncate">{r.match}</div>
                    </div>
                  </div>
                  <div className="font-mono text-[10.5px] font-semibold text-white rounded bg-zinc-800 px-2 py-0.5 shrink-0 ml-2">
                    {r.score}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3.5 flex justify-between border-t border-zinc-800/80 pt-3 font-mono text-[10.5px] text-zinc-400">
              <span>HNSW Index (m=16, ef=64)</span>
              <span>Latency: 34ms</span>
              <span>SQL Isolation: Enforced</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- FEATURE MONITORING & DEVELOPER SDK ----------------------------- */
function FeatureMonitoring() {
  const [activeTab, setActiveTab] = useState<"trace" | "sdk">("trace");
  const [copiedCode, setCopiedCode] = useState(false);

  const steps = [
    { name: "Trigger Check", duration: "0ms", state: "CACHED" },
    { name: "DAG Topological Sort", duration: "0ms", state: "CACHED" },
    { name: "Credit Hold Reservation", duration: "12ms", state: "200 OK" },
    { name: "LLM Primary (Groq)", duration: "488ms", state: "200 OK" },
    { name: "Action Webhook Dispatch", duration: "104ms", state: "200 OK" },
  ];

  const handleCopyCode = () => {
    const rawCode = `import { defineWorkflow, agentNode, memoryNode, actionNode } from "@cognify/sdk";

export default defineWorkflow({
  id: "support-triage-mesh",
  circuitBreaker: { maxRetries: 3, timeoutMs: 5000 },
  nodes: [
    agentNode("intent", { model: "groq/llama-3.3", replayCache: true }),
    memoryNode("rag", { algorithm: "RRF(k=60)", tenantIsolation: true }),
    actionNode("dispatch", { channel: "escalations", idempotent: true }),
  ],
});`;
    navigator.clipboard.writeText(rawCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <section className="border-b border-white/10 bg-black py-20" id="observability">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 items-center">
        <div className="lg:col-span-5 text-left">
          <SectionHeader
            eyebrow="03 — REALTIME OBSERVABILITY & DX"
            title="Inspect every token, latency, and step replay state."
            desc="Every execution emits monotonic distributed sequence events over Redis Pub/Sub to Socket.io clients. If an upstream LLM node fails, retrying re-executes only downstream nodes."
          />
          <div className="mt-6 flex flex-wrap gap-2">
            {["Monotonic Redis INCR Sequence", "75%+ Token Savings on Replay", "LLM Circuit Breakers"].map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border border-white/10 bg-white/5 text-zinc-300">
                <Check className="size-3 text-white" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("trace")}
                  className={`px-2.5 py-1 rounded-md font-mono text-[10.5px] transition-colors cursor-pointer ${
                    activeTab === "trace"
                      ? "bg-white !text-black font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <LineChart className="size-3" />
                    trace.run_9b14
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("sdk")}
                  className={`px-2.5 py-1 rounded-md font-mono text-[10.5px] transition-colors cursor-pointer ${
                    activeTab === "sdk"
                      ? "bg-white !text-black font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FileCode className="size-3" />
                    workflow.dag.ts
                  </span>
                </button>
              </div>

              {activeTab === "sdk" ? (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-[10.5px] font-mono text-zinc-300 transition-colors cursor-pointer"
                  title="Copy code"
                >
                  {copiedCode ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  <span>{copiedCode ? "Copied" : "Copy"}</span>
                </button>
              ) : (
                <span className="font-mono text-[10.5px] text-zinc-400">Total: 604ms</span>
              )}
            </div>

            {activeTab === "trace" ? (
              <div className="mt-3.5 space-y-2 font-mono">
                {steps.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-3 py-2 text-[11px]"
                  >
                    <div className="flex items-center gap-2 text-zinc-200">
                      <span className="size-1.5 rounded-full bg-white" />
                      <span>{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-400">
                      <span>{s.duration}</span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9.5px] ${
                          s.state === "CACHED"
                            ? "border-zinc-700 bg-zinc-800/80 text-zinc-400 font-mono"
                            : "border-white/20 bg-white/5 text-white"
                        }`}
                      >
                        {s.state}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* High-contrast syntax-highlighted code block */
              <div className="mt-3.5 p-4 rounded-xl border border-zinc-800 bg-black font-mono text-[11px] leading-relaxed overflow-x-auto text-left">
                <div className="text-zinc-500">// TypeScript DAG Pipeline definition</div>
                <div>
                  <span className="text-purple-400">export default</span> <span className="text-sky-300">defineWorkflow</span>(&#123;
                </div>
                <div className="pl-4">
                  id: <span className="text-emerald-300">"support-triage-mesh"</span>,
                </div>
                <div className="pl-4">
                  circuitBreaker: &#123; maxRetries: <span className="text-amber-300">3</span>, timeoutMs: <span className="text-amber-300">5000</span> &#125;,
                </div>
                <div className="pl-4">
                  nodes: [
                </div>
                <div className="pl-8">
                  <span className="text-sky-300">agentNode</span>(<span className="text-emerald-300">"intent"</span>, &#123; model: <span className="text-emerald-300">"groq/llama-3.3"</span>, replayCache: <span className="text-amber-300">true</span> &#125;),
                </div>
                <div className="pl-8">
                  <span className="text-sky-300">memoryNode</span>(<span className="text-emerald-300">"rag"</span>, &#123; algorithm: <span className="text-emerald-300">"RRF(k=60)"</span>, tenantIsolation: <span className="text-amber-300">true</span> &#125;),
                </div>
                <div className="pl-8">
                  <span className="text-sky-300">actionNode</span>(<span className="text-emerald-300">"dispatch"</span>, &#123; channel: <span className="text-emerald-300">"escalations"</span>, idempotent: <span className="text-amber-300">true</span> &#125;),
                </div>
                <div className="pl-4">
                  ],
                </div>
                <div>
                  &#125;);
                </div>
              </div>
            )}

            <div className="mt-3.5 flex justify-between border-t border-zinc-800/80 pt-2.5 font-mono text-[10px] text-zinc-400">
              <span>step_replay_cache: HIT (75%+ token reduction)</span>
              <span>Redis Pub/Sub: Monotonic</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- CTA ----------------------------- */
function CTA() {
  const startHref = useAuthTarget();

  return (
    <section className="border-b border-white/10 bg-zinc-950/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-black p-10 text-center md:p-16 shadow-2xl">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08)_0%,_transparent_70%)]" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Build resilient AI systems that run in production.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3.5">
              <Button
                as={Link}
                to={startHref}
                size="lg"
                variant="primary"
                className="whitespace-nowrap inline-flex items-center justify-center gap-2"
              >
                Start Building Free
                <ArrowRight className="size-4 shrink-0 ml-1" />
              </Button>
              <Button as="a" href="https://github.com/shankywho/COGNIFY" size="lg" variant="secondary">
                View on GitHub
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- FOOTER ----------------------------- */
function Footer() {
  const cols = [
    {
      title: "Platform",
      links: [
        { label: "Visual DAG", href: "/dashboard/workflows" },
        { label: "Multi-Agent Mesh", href: "/dashboard/agents" },
        { label: "Vector Memory", href: "/dashboard/workspaces" },
        { label: "Realtime Telemetry", href: "/dashboard/analytics" },
        { label: "Pricing Tiers", href: "/pricing" },
      ],
    },
    {
      title: "Engine",
      links: [
        { label: "BullMQ Queue Pools", href: "https://github.com/shankywho/COGNIFY#architecture" },
        { label: "Circuit Breakers", href: "https://github.com/shankywho/COGNIFY#circuit-breakers" },
        { label: "Redis Monotonic Events", href: "https://github.com/shankywho/COGNIFY" },
        { label: "Vault Encryption", href: "https://github.com/shankywho/COGNIFY" },
      ],
    },
    {
      title: "Developers",
      links: [
        { label: "Architecture ADRs", href: "https://github.com/shankywho/COGNIFY/tree/main/docs" },
        { label: "GitHub Repository", href: "https://github.com/shankywho/COGNIFY" },
        { label: "Contributing Guide", href: "https://github.com/shankywho/COGNIFY/blob/main/CONTRIBUTING.md" },
        { label: "About Cognify", href: "/about" },
      ],
    },
    {
      title: "Compliance",
      links: [
        { label: "SQL Multi-Tenancy", href: "https://github.com/shankywho/COGNIFY" },
        { label: "Self-Hosted Docker", href: "https://github.com/shankywho/COGNIFY#quickstart" },
        { label: "Idempotent Webhooks", href: "https://github.com/shankywho/COGNIFY" },
        { label: "Apache 2.0 License", href: "https://github.com/shankywho/COGNIFY/blob/main/LICENSE" },
      ],
    },
  ];

  return (
    <footer className="bg-black py-14 text-zinc-400">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 md:grid-cols-6">
          <div className="md:col-span-2 text-left">
            <Logo size={26} />
            <p className="mt-3 max-w-xs text-xs text-zinc-400 leading-relaxed">
              Enterprise AI Operations & Multi-Agent Orchestration Platform.
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.title} className="text-left">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-300 font-semibold">
                {col.title}
              </div>
              <ul className="mt-3 space-y-1.5 text-xs">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("http") ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-400 transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-zinc-400 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs text-zinc-400 md:flex-row md:items-center">
          <div>© 2026 Cognify Inc. Licensed under Apache 2.0.</div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-zinc-300">
              <span className="size-1.5 rounded-full bg-white animate-pulse" />
              All Systems Operational
            </span>
            <span>35 / 35 CI Passing</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
