import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { api, type PaymentRow } from "@/lib/api";
import { formatPaisa, timeAgo } from "@/lib/format";
import { useLive } from "@/context/LiveContext";

const STATUS_VARIANT: Record<string, "success" | "danger" | "default"> = {
  captured: "success",
  failed: "danger",
  refunded: "default",
};
const METHOD_LABEL: Record<string, string> = {
  upi: "UPI", card: "Card", netbanking: "Netbanking", wallet: "Wallet",
};

export function RecentPayments() {
  const { livePayments, pulse } = useLive();
  const [base, setBase] = useState<PaymentRow[]>([]);

  useEffect(() => {
    api.payments().then(setBase).catch(() => {});
  }, [pulse]);

  // Merge streamed live payments on top of the fetched base, de-duplicated.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const merged: PaymentRow[] = [];
    for (const p of [...livePayments, ...base]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }
    return merged.slice(0, 18);
  }, [livePayments, base]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Live Payments</CardTitle>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 animate-pulse-ring rounded-full bg-success" /> streaming
        </span>
      </CardHeader>
      <div className="scroll-thin -mr-2 overflow-y-auto pr-2" style={{ maxHeight: 420 }}>
        <table className="w-full text-sm">
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((p) => (
                <motion.tr
                  key={p.id}
                  layout
                  initial={{ opacity: 0, backgroundColor: "rgba(51,149,255,0.10)" }}
                  animate={{ opacity: 1, backgroundColor: "rgba(51,149,255,0)" }}
                  transition={{ duration: 0.6 }}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="py-2.5">
                    <div className="font-medium text-ink">{p.customer_name}</div>
                    <div className="text-[11px] text-muted">
                      {timeAgo(p.created_at)}
                      {p.source === "checkout" && <span className="ml-1 text-brand">· checkout</span>}
                    </div>
                  </td>
                  <td className="py-2.5 text-center text-xs text-muted">{METHOD_LABEL[p.method] ?? p.method}</td>
                  <td className="py-2.5 text-right font-semibold text-ink tabular">{formatPaisa(p.amount)}</td>
                  <td className="py-2.5 pl-3 text-right">
                    <Badge variant={STATUS_VARIANT[p.status] ?? "default"}>{p.status}</Badge>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
