import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, RefreshCw, Sheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, Badge, Button } from "@/components/ui/primitives";
import { api, type LedgerRow } from "@/lib/api";
import { formatPaisa, timeAgo } from "@/lib/format";
import { useLive } from "@/context/LiveContext";
import { cn } from "@/lib/utils";

const TYPE_VARIANT: Record<string, "brand" | "success" | "purple" | "default"> = {
  Payment: "brand",
  Settlement: "success",
  Invoice: "purple",
};
const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default"> = {
  captured: "success", processed: "success", paid: "success",
  failed: "danger", overdue: "warning", pending: "default", refunded: "default",
};

export function LedgerPage() {
  const { pulse } = useLive();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [sheets, setSheets] = useState<{ enabled: boolean; webhook_url: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { api.ledger().then((d) => setRows(d.rows)).catch(() => {}); }, [pulse]);
  useEffect(() => { api.integrations().then((d) => setSheets(d.sheets)).catch(() => {}); }, []);

  async function sync() {
    setSyncing(true);
    try {
      const r = await api.ledgerSync();
      if (r.pushed) toast.success(`Synced ${r.pushed} rows to Google Sheets`);
      else toast.error(r.reason === "not configured" ? "Add a Google Sheets webhook in Settings first" : `Sync failed: ${r.reason}`);
    } catch { toast.error("Sync failed"); }
    finally { setSyncing(false); }
  }

  const totalIn = rows.filter((r) => r.type === "Payment" && r.status === "captured").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Ledger rows" value={String(rows.length)} />
        <Stat label="Captured inflow" value={formatPaisa(totalIn)} accent="text-success" />
        <Stat label="Settlements" value={String(rows.filter((r) => r.type === "Settlement").length)} />
        <Stat label="Sheets sync" value={sheets?.enabled ? "Connected" : "Off"} accent={sheets?.enabled ? "text-success" : "text-muted"} />
      </div>

      <Card className="p-0">
        <CardHeader className="px-6 pt-5">
          <CardTitle>Real-time Transaction Ledger</CardTitle>
          <div className="flex gap-2">
            <a href="/api/ledger/export.csv" download>
              <Button variant="secondary" size="sm"><Download className="h-4 w-4" /> Export CSV</Button>
            </a>
            <Button size="sm" onClick={sync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />} Sync to Sheets
            </Button>
          </div>
        </CardHeader>

        {!sheets?.enabled && (
          <div className="mx-6 mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <RefreshCw className="h-3.5 w-3.5" />
            Connect a Google Sheet in Settings → Integrations to mirror this ledger live.
          </div>
        )}

        <div className="scroll-thin overflow-auto" style={{ maxHeight: 560 }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-6 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Method / UTR</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-6 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((r, i) => (
                  <motion.tr
                    key={`${r.reference}-${i}`}
                    layout
                    initial={{ opacity: 0, backgroundColor: "rgba(51,149,255,0.08)" }}
                    animate={{ opacity: 1, backgroundColor: "rgba(0,0,0,0)" }}
                    transition={{ duration: 0.5 }}
                    className="border-b border-slate-50"
                  >
                    <td className="px-6 py-2.5 text-xs text-muted">{timeAgo(r.timestamp)}</td>
                    <td className="px-4 py-2.5"><Badge variant={TYPE_VARIANT[r.type] ?? "default"}>{r.type}</Badge></td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{r.reference}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{r.party}</td>
                    <td className="max-w-[180px] truncate px-4 py-2.5 font-mono text-[11px] text-muted">{r.detail}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink tabular">{formatPaisa(r.amount)}</td>
                    <td className="px-6 py-2.5 text-right">
                      <Badge variant={STATUS_VARIANT[r.status] ?? "default"}>{r.status}</Badge>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-1 font-display text-xl font-extrabold text-ink", accent)}>{value}</div>
    </Card>
  );
}
