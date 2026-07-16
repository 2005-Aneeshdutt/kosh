import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Smartphone, Building2, Loader2, CheckCircle2, XCircle,
  Lock, ShieldCheck, ArrowLeft,
} from "lucide-react";
import { api, type PayInfo, type PayResult } from "@/lib/api";
import { formatPaisa } from "@/lib/format";
import { cn } from "@/lib/utils";

type Method = "card" | "upi" | "netbanking";
type Stage = "form" | "processing" | "done";

const BANKS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra"];

function detectBrand(num: string): string {
  const n = num.replace(/\D/g, "");
  if (n.startsWith("4")) return "VISA";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "MC";
  if (/^3[47]/.test(n)) return "AMEX";
  if (n.startsWith("6")) return "RuPay";
  return "";
}

export function CheckoutPage() {
  const { invoiceId = "" } = useParams();
  const [info, setInfo] = useState<PayInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [method, setMethod] = useState<Method>("card");
  const [stage, setStage] = useState<Stage>("form");
  const [result, setResult] = useState<PayResult | null>(null);

  // card fields
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [vpa, setVpa] = useState("");
  const [bank, setBank] = useState(BANKS[0]);

  useEffect(() => {
    api.payInfo(invoiceId).then(setInfo).catch(() => setNotFound(true));
  }, [invoiceId]);

  const brand = useMemo(() => detectBrand(card), [card]);
  const alreadyPaid = info?.status === "paid";

  function onCard(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    setCard(digits.replace(/(.{4})/g, "$1 ").trim());
  }
  function onExpiry(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4);
    setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
  }

  const canPay =
    method === "card" ? card.replace(/\s/g, "").length >= 12 && expiry.length === 5 && cvv.length >= 3
    : method === "upi" ? vpa.includes("@")
    : true;

  async function pay() {
    if (!info) return;
    setStage("processing");
    const payload: Record<string, unknown> = { invoice_id: invoiceId, method };
    if (method === "card") Object.assign(payload, { card_number: card, card_expiry: expiry, card_cvv: cvv, card_name: name });
    if (method === "upi") payload.vpa = vpa;
    if (method === "netbanking") payload.bank = bank;

    // A brief, believable processing delay.
    await new Promise((r) => setTimeout(r, 1900));
    try {
      const res = await api.checkoutPay(payload);
      setResult(res);
    } catch (e) {
      setResult({
        success: false, status: "failed", failure_reason: e instanceof Error ? e.message : "error",
        payment_id: "", amount: info.amount, method, invoice_id: invoiceId,
      });
    }
    setStage("done");
  }

  if (notFound) {
    return <Centered><div className="text-center text-slate-500">Payment link not found.</div></Centered>;
  }
  if (!info) {
    return <Centered><Loader2 className="h-6 w-6 animate-spin text-brand" /></Centered>;
  }

  return (
    <Centered>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-[400px] overflow-hidden rounded-2xl bg-white shadow-pop"
      >
        {/* Header */}
        <div className="bg-navy-900 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-bold">
                {info.merchant_name.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-semibold">{info.merchant_name}</div>
                <div className="text-[11px] text-slate-400">{info.description}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-extrabold tabular">{formatPaisa(info.amount)}</div>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {stage === "done" && result ? (
            <ResultView key="done" result={result} amount={info.amount} onRetry={() => { setStage("form"); setResult(null); }} />
          ) : stage === "processing" ? (
            <Processing key="proc" method={method} />
          ) : alreadyPaid ? (
            <motion.div key="paid" className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <div className="mt-3 text-lg font-bold text-ink">Already paid</div>
              <div className="text-sm text-muted">This invoice has been settled. Thank you!</div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5">
              {/* Method tabs */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                {([
                  { m: "card", icon: CreditCard, label: "Card" },
                  { m: "upi", icon: Smartphone, label: "UPI" },
                  { m: "netbanking", icon: Building2, label: "Netbank" },
                ] as const).map(({ m, icon: Icon, label }) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition",
                      method === m ? "border-brand bg-brand-light text-brand-dark" : "border-border text-muted hover:border-slate-300"
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {method === "card" && (
                <div className="space-y-3">
                  <Field label="Card number">
                    <div className="relative">
                      <input value={card} onChange={(e) => onCard(e.target.value)} inputMode="numeric"
                        placeholder="4111 1111 1111 1111" className={inp} />
                      {brand && <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{brand}</span>}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Expiry"><input value={expiry} onChange={(e) => onExpiry(e.target.value)} placeholder="MM/YY" className={inp} inputMode="numeric" /></Field>
                    <Field label="CVV"><input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" type="password" className={inp} inputMode="numeric" /></Field>
                  </div>
                  <Field label="Name on card"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inp} /></Field>
                  <p className="text-[11px] text-muted">Test: <span className="font-mono">4111 1111 1111 1111</span> succeeds · <span className="font-mono">4000 0000 0000 0002</span> declines</p>
                </div>
              )}

              {method === "upi" && (
                <div className="space-y-3">
                  <Field label="UPI ID / VPA"><input value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="name@okhdfc" className={inp} /></Field>
                  <p className="text-[11px] text-muted">Tip: include <span className="font-mono">fail</span> in the VPA to simulate a decline.</p>
                </div>
              )}

              {method === "netbanking" && (
                <Field label="Select your bank">
                  <select value={bank} onChange={(e) => setBank(e.target.value)} className={inp}>
                    {BANKS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </Field>
              )}

              <button
                onClick={pay}
                disabled={!canPay}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-bold text-white shadow-glow transition hover:bg-brand-dark disabled:opacity-40"
              >
                <Lock className="h-4 w-4" /> Pay {formatPaisa(info.amount)}
              </button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-success" /> Secured by Razorpay · 256-bit encrypted
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Centered>
  );
}

const inp =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</label>
      {children}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 grid-bg p-4">
      {children}
    </div>
  );
}

function Processing({ method }: { method: Method }) {
  const steps = ["Contacting your bank", "Authenticating", "Confirming payment"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => Math.min(steps.length - 1, v + 1)), 620);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center px-6 py-12">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-brand/20" />
        <Loader2 className="absolute inset-0 m-auto h-16 w-16 animate-spin text-brand" strokeWidth={1.5} />
      </div>
      <div className="mt-6 text-sm font-semibold text-ink">{steps[i]}…</div>
      <div className="mt-1 text-xs text-muted">Do not close this window · paying via {method.toUpperCase()}</div>
    </motion.div>
  );
}

function ResultView({ result, amount, onRetry }: { result: PayResult; amount: number; onRetry: () => void }) {
  return (
    <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="px-6 py-9 text-center">
      {result.success ? (
        <>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          </motion.div>
          <div className="mt-4 text-xl font-extrabold text-ink">Payment successful</div>
          <div className="mt-1 text-sm text-muted">{formatPaisa(amount)} paid to the merchant</div>
          <div className="mt-5 space-y-1.5 rounded-xl bg-slate-50 p-4 text-left text-xs">
            <Row k="Payment ID" v={result.payment_id} />
            <Row k="Method" v={result.method.toUpperCase() + (result.brand ? ` · ${result.brand}` : "")} />
            <Row k="Status" v="Captured" />
          </div>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Receipt emailed to you
          </div>
          <p className="mt-4 text-[11px] text-muted">You can close this window. The merchant dashboard has been updated live.</p>
        </>
      ) : (
        <>
          <XCircle className="mx-auto h-16 w-16 text-danger" />
          <div className="mt-4 text-xl font-extrabold text-ink">Payment failed</div>
          <div className="mt-1 text-sm text-muted">{(result.failure_reason || "declined").replace(/_/g, " ")}</div>
          <button onClick={onRetry} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Try another method
          </button>
        </>
      )}
    </motion.div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className="truncate font-mono font-medium text-ink">{v}</span>
    </div>
  );
}
