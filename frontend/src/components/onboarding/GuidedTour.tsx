import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, ArrowRight, X } from "lucide-react";

const TOUR_KEY = "kosh-tour-done";

type Step = {
  selector: string;
  title: string;
  body: string;
  placement?: "right" | "bottom" | "left" | "top";
};

const STEPS: Step[] = [
  { selector: '[data-tour="nav"]', title: "Your revenue command center", body: "Every surface of the operation lives here — collections, autopilot, forecasting, reconciliation and the agent crew.", placement: "right" },
  { selector: '[data-tour="metrics"]', title: "Live business metrics", body: "Revenue, success rate and receivables update in real time as payments stream in. Watch the numbers move.", placement: "bottom" },
  { selector: '[data-tour="run"]', title: "Deploy the AI crew", body: "One click runs all four agents — they collect, reconcile, forecast and monitor, then update this dashboard.", placement: "bottom" },
  { selector: '[data-tour="palette"]', title: "Command anything with ⌘K", body: "Jump to any page, run agents, or ask the Copilot from anywhere — no mouse required.", placement: "bottom" },
  { selector: '[data-tour="copilot"]', title: "Ask the Copilot", body: "Ask about your revenue, or tell it to send a reminder or collect a payment — it actually takes the action.", placement: "left" },
];

export function useTourControls() {
  const start = useCallback(() => {
    window.localStorage.removeItem(TOUR_KEY);
    window.dispatchEvent(new CustomEvent("kosh:start-tour"));
  }, []);
  return { start };
}

export function GuidedTour() {
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const begin = useCallback(() => setStep(0), []);

  // Auto-start once for first-time visitors (after the dashboard paints).
  useEffect(() => {
    const seen = window.localStorage.getItem(TOUR_KEY);
    const onStart = () => setStep(0);
    window.addEventListener("kosh:start-tour", onStart);
    let t: number | undefined;
    if (!seen && window.location.pathname === "/") {
      t = window.setTimeout(() => {
        if (document.querySelector(STEPS[0].selector)) begin();
      }, 1100);
    }
    return () => { window.removeEventListener("kosh:start-tour", onStart); if (t) window.clearTimeout(t); };
  }, [begin]);

  // Track the target element's position (and follow resizes/scrolls).
  useLayoutEffect(() => {
    if (step < 0) return;
    const measure = () => {
      const el = document.querySelector(STEPS[step].selector);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [step]);

  const finish = useCallback(() => {
    window.localStorage.setItem(TOUR_KEY, "1");
    setStep(-1);
    setRect(null);
  }, []);

  const next = useCallback(() => {
    // Skip steps whose target isn't on the page.
    let i = step + 1;
    while (i < STEPS.length && !document.querySelector(STEPS[i].selector)) i++;
    if (i >= STEPS.length) finish();
    else setStep(i);
  }, [step, finish]);

  if (step < 0) return null;

  const s = STEPS[step];
  const pad = 8;
  const box = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  // Tooltip position relative to the highlighted box.
  const tip = (() => {
    if (!box) return { top: window.innerHeight / 2 - 80, left: window.innerWidth / 2 - 170 };
    const W = 340, gap = 16;
    switch (s.placement) {
      case "right": return { top: box.top, left: Math.min(box.left + box.width + gap, window.innerWidth - W - 16) };
      case "left": return { top: box.top, left: Math.max(box.left - W - gap, 16) };
      case "top": return { top: box.top - 176, left: Math.min(Math.max(box.left, 16), window.innerWidth - W - 16) };
      default: return { top: box.top + box.height + gap, left: Math.min(Math.max(box.left, 16), window.innerWidth - W - 16) };
    }
  })();

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Dim + spotlight hole via a big box-shadow on the highlighted rect. */}
      {box && (
        <motion.div
          initial={false}
          animate={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="pointer-events-none absolute rounded-2xl ring-2 ring-brand"
          style={{ boxShadow: "0 0 0 9999px rgba(7,14,31,0.72)" }}
        />
      )}
      {/* Click-catcher to advance when clicking the dim area. */}
      <div className="absolute inset-0" onClick={next} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          style={{ top: tip.top, left: tip.left, width: 340 }}
          className="absolute rounded-2xl border border-border bg-card p-5 shadow-pop"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand">
              <Sparkles className="h-3.5 w-3.5" /> Step {step + 1} of {STEPS.length}
            </span>
            <button onClick={finish} className="text-muted hover:text-ink" aria-label="Skip tour">
              <X className="h-4 w-4" />
            </button>
          </div>
          <h3 className="font-display text-lg font-bold text-ink">{s.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-brand" : "w-1.5 bg-slate-300"}`} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={finish} className="text-xs font-medium text-muted hover:text-ink">Skip</button>
              <button
                onClick={next}
                className="flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3.5 py-2 text-xs font-semibold text-white shadow-glow"
              >
                {step === STEPS.length - 1 ? "Finish" : "Next"} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
