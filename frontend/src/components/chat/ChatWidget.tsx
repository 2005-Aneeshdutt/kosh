import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X, Send, Sparkles, ExternalLink, ArrowRight, Loader2, Bot, FileText } from "lucide-react";
import { api, type ChatAction, type ChatCitation } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string; actions?: ChatAction[]; citations?: ChatCitation[] }

const SUGGESTIONS = [
  "How are we doing?",
  "Who's overdue?",
  "How much did Cardamom & Co. pay?",
  "Pay the biggest overdue invoice",
  "Run the agents",
];

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm the Kosh Copilot. Ask me about your revenue, or tell me to send a reminder, " +
    "create a pay link, or collect a payment — I'll actually do it.",
};

export function ChatWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    const history = [...msgs, { role: "user" as const, content: clean }];
    setMsgs(history);
    setInput("");
    setBusy(true);
    try {
      const res = await api.chat(
        history.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.content }))
      );
      setMsgs((m) => [...m, { role: "assistant", content: res.reply, actions: res.actions, citations: res.citations }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Sorry — I couldn't reach the backend just now." }]);
    } finally {
      setBusy(false);
    }
  }

  function runAction(a: ChatAction) {
    if (a.type === "open_checkout" && a.url) window.open(a.url, "_blank");
    else if (a.type === "navigate" && a.to) { navigate(a.to); setOpen(false); }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-glow transition hover:bg-brand-dark"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ opacity: 0 }}><X className="h-6 w-6" /></motion.span>
            : <motion.span key="c" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ opacity: 0 }}><MessageSquare className="h-6 w-6" /></motion.span>}
        </AnimatePresence>
        {!open && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-brand bg-success" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            className="fixed bottom-24 right-6 z-40 flex h-[560px] w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-pop"
          >
            {/* Header */}
            <div className="flex items-center gap-3 bg-navy-900 px-5 py-4 text-white">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand">
                <Sparkles className="h-4.5 w-4.5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-navy-900 bg-success" />
              </div>
              <div>
                <div className="text-sm font-bold">Kosh Copilot</div>
                <div className="text-[11px] text-slate-400">AI ops assistant · can take actions</div>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto bg-canvas p-4">
              {msgs.map((m, i) => (
                <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "assistant" && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div className={cn("max-w-[78%]")}>
                    <div
                      className={cn(
                        "whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                        m.role === "user" ? "bg-brand text-white" : "border border-border bg-white text-slate-700"
                      )}
                    >
                      {m.content}
                    </div>
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.actions.map((a, j) => (
                          <button
                            key={j}
                            onClick={() => runAction(a)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand-light px-2.5 py-1.5 text-xs font-semibold text-brand-dark transition hover:bg-brand/10"
                          >
                            {a.type === "open_checkout" ? <ExternalLink className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-2">
                        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          <FileText className="h-3 w-3" /> Sources
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.citations.map((c, j) => (
                            <span key={j} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600" title={c.label}>
                              <span className="font-mono font-semibold text-slate-500">{c.ref}</span>
                              <span className="max-w-[120px] truncate">{c.label}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Copilot is thinking…
                </div>
              )}

              {msgs.length <= 1 && (
                <div className="space-y-1.5 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="block w-full rounded-xl border border-border bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-brand hover:text-brand-dark"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2 border-t border-border bg-white p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask, or tell me to pay / remind…"
                className="flex-1 rounded-xl border border-border bg-canvas px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
              <button type="submit" disabled={busy || !input.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
