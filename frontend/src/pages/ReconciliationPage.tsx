import { useEffect, useRef, useState } from "react";
import { UploadCloud, FileCheck2, Loader2, Download } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, Badge, Button } from "@/components/ui/primitives";
import { api, type ReconResult } from "@/lib/api";
import { formatPaisa } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "matched", "unmatched", "discrepancies"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_META: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  matched: { label: "Matched", variant: "success" },
  discrepancy: { label: "Discrepancy", variant: "warning" },
  unmatched_bank: { label: "Unmatched (bank)", variant: "danger" },
  unmatched_razorpay: { label: "Not yet credited", variant: "default" },
};

export function ReconciliationPage() {
  const [result, setResult] = useState<ReconResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.reconResults().then((r) => r.ran && setResult(r)).catch(() => {});
  }, []);

  async function upload(file: File) {
    setLoading(true);
    try {
      const res = await api.uploadStatement(file);
      setResult(res.recon);
      toast.success(`Parsed ${res.rows_parsed} rows · ${(res.recon.match_rate * 100).toFixed(1)}% matched`);
    } catch {
      toast.error("Upload failed — is it a CSV or PDF bank statement?");
    } finally {
      setLoading(false);
    }
  }

  async function useSample() {
    setLoading(true);
    try {
      const { csv, filename } = await (await fetch("/api/reconciliation/sample")).json();
      await upload(new File([csv], filename, { type: "text/csv" }));
    } catch {
      toast.error("Could not load sample");
      setLoading(false);
    }
  }

  const entries = (result?.entries ?? []).filter((e) => {
    if (filter === "all") return true;
    if (filter === "matched") return e.status === "matched";
    if (filter === "discrepancies") return e.status === "discrepancy";
    return e.status.startsWith("unmatched");
  });

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <Card>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-brand bg-blue-50/50" : "border-border bg-slate-50/50"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-brand" />
              <p className="font-medium text-ink">Recon agent is matching entries…</p>
            </>
          ) : (
            <>
              <UploadCloud className="mb-3 h-8 w-8 text-muted" />
              <p className="font-semibold text-ink">Drop your bank statement here</p>
              <p className="mt-1 text-sm text-muted">CSV or PDF · we auto-detect columns & UTRs</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                  Browse files
                </Button>
                <Button variant="ghost" onClick={useSample}>
                  Use demo statement
                </Button>
                <a href="/api/reconciliation/sample.csv" download>
                  <Button variant="ghost"><Download className="h-4 w-4" /> Download sample CSV</Button>
                </a>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </>
          )}
        </div>
      </Card>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <Summary
                label="Match rate"
                value={`${(result.match_rate * 100).toFixed(1)}%`}
                accent="text-success"
                icon
              />
              <Summary label="Matched amount" value={formatPaisa(result.total_matched_amount)} />
              <Summary
                label="Needs review"
                value={String(
                  result.entries.filter((e) => e.status !== "matched").length
                )}
                accent="text-warning"
              />
            </div>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Reconciliation Summary</CardTitle>
                <Badge variant="brand">Claude-authored</Badge>
              </CardHeader>
              <p className="text-[15px] leading-relaxed text-slate-700">{result.summary}</p>
              <div className="mt-4 flex gap-6 text-sm">
                <Stat n={result.total_bank_entries} label="bank rows" />
                <Stat n={result.total_settlements} label="settlements" />
                <Stat n={result.matched} label="matched" />
              </div>
            </Card>
          </div>

          <Card className="p-0">
            <div className="flex gap-1 border-b border-border px-4 pt-3">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-t-lg px-3 py-2 text-sm font-medium capitalize transition-colors",
                    filter === f ? "bg-slate-100 text-ink" : "text-muted hover:text-ink"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">UTR</th>
                    <th className="px-4 py-3 font-medium">Bank</th>
                    <th className="px-4 py-3 font-medium">Razorpay</th>
                    <th className="px-6 py-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => {
                    const meta = STATUS_META[e.status] ?? STATUS_META.matched;
                    return (
                      <tr key={i} className="border-t border-slate-50">
                        <td className="px-6 py-3 text-muted">{e.date ?? "—"}</td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-slate-700">
                          {e.description ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted">{e.utr ?? "—"}</td>
                        <td className="px-4 py-3">
                          {e.bank_amount != null ? formatPaisa(e.bank_amount) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {e.razorpay_amount != null ? formatPaisa(e.razorpay_amount) : "—"}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: boolean;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      {icon && (
        <div className="rounded-xl bg-emerald-50 p-2 text-success">
          <FileCheck2 className="h-5 w-5" />
        </div>
      )}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <div className={cn("text-xl font-extrabold text-ink", accent)}>{value}</div>
      </div>
    </Card>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <span className="text-lg font-bold text-ink">{n}</span>{" "}
      <span className="text-muted">{label}</span>
    </div>
  );
}
