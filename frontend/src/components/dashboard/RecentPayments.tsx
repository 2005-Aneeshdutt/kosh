import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { api, type PaymentRow } from "@/lib/api";
import { formatPaisa, timeAgo } from "@/lib/format";
import { useRun } from "@/context/RunContext";

const STATUS_VARIANT: Record<string, "success" | "danger" | "default"> = {
  captured: "success",
  failed: "danger",
  refunded: "default",
};

const METHOD_LABEL: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Netbanking",
  wallet: "Wallet",
};

export function RecentPayments() {
  const { runVersion } = useRun();
  const [rows, setRows] = useState<PaymentRow[]>([]);

  useEffect(() => {
    api.payments().then(setRows).catch(() => {});
  }, [runVersion]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Recent Payments</CardTitle>
        <span className="text-xs text-muted">Live feed</span>
      </CardHeader>
      <div className="scroll-thin -mr-2 overflow-y-auto pr-2" style={{ maxHeight: 420 }}>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0">
                <td className="py-2.5">
                  <div className="font-medium text-ink">{p.customer_name}</div>
                  <div className="text-[11px] text-muted">{timeAgo(p.created_at)}</div>
                </td>
                <td className="py-2.5 text-center text-xs text-muted">
                  {METHOD_LABEL[p.method] ?? p.method}
                </td>
                <td className="py-2.5 text-right font-semibold text-ink">
                  {formatPaisa(p.amount)}
                </td>
                <td className="py-2.5 pl-3 text-right">
                  <Badge variant={STATUS_VARIANT[p.status] ?? "default"}>{p.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
