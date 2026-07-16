import { useEffect, useState } from "react";
import { Send, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge, Button, Progress } from "@/components/ui/primitives";
import { ReminderModal } from "@/components/collections/ReminderModal";
import { api, type DebtorRow, type ReminderResponse } from "@/lib/api";
import { formatPaisa, formatDate } from "@/lib/format";
import { useRun } from "@/context/RunContext";
import { useLive } from "@/context/LiveContext";
import { cn } from "@/lib/utils";

const BAND_VARIANT: Record<string, "success" | "warning" | "danger" | "brand"> = {
  low: "success",
  medium: "brand",
  high: "warning",
  critical: "danger",
};

const BAND_BAR: Record<string, string> = {
  low: "bg-success",
  medium: "bg-brand",
  high: "bg-warning",
  critical: "bg-danger",
};

export function CollectionsPage() {
  const { runVersion } = useRun();
  const { pulse } = useLive();
  const [debtors, setDebtors] = useState<DebtorRow[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [modal, setModal] = useState<{ reminder: ReminderResponse; customer: string } | null>(null);

  const load = () => api.debtors().then(setDebtors).catch(() => {});
  useEffect(() => {
    load();
  }, [runVersion, pulse]);

  async function handleSend(d: DebtorRow) {
    setSending(d.id);
    try {
      const reminder = await api.sendReminder(d.id);
      setModal({ reminder, customer: d.customer_name });
      load();
    } catch {
      toast.error("Could not generate reminder");
    } finally {
      setSending(null);
    }
  }

  const totalOutstanding = debtors.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Open debtors" value={String(debtors.length)} />
        <Stat label="Outstanding" value={formatPaisa(totalOutstanding)} />
        <Stat
          label="Critical risk"
          value={String(debtors.filter((d) => d.risk_band === "critical").length)}
          accent="text-danger"
        />
        <Stat
          label="High risk"
          value={String(debtors.filter((d) => d.risk_band === "high").length)}
          accent="text-warning"
        />
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Overdue</th>
                <th className="px-4 py-3 font-medium">Risk score</th>
                <th className="px-4 py-3 font-medium">Reminders</th>
                <th className="px-6 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-ink">{d.customer_name}</div>
                    <div className="text-[11px] text-muted">{d.id} · {d.customer_email}</div>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-ink">{formatPaisa(d.amount)}</td>
                  <td className="px-4 py-3.5 text-muted">{formatDate(d.due_date)}</td>
                  <td className="px-4 py-3.5">
                    {d.days_overdue > 0 ? (
                      <span className="font-medium text-danger">{d.days_overdue}d</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={d.risk_score * 100}
                        className="w-20"
                        barClassName={BAND_BAR[d.risk_band]}
                      />
                      <Badge variant={BAND_VARIANT[d.risk_band]}>{d.risk_score.toFixed(2)}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-muted">{d.reminders_sent}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleSend(d)} disabled={sending === d.id}>
                        {sending === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Remind
                      </Button>
                      <a href={`/pay/${d.id}`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" title="Open the live payment page a customer would see">
                          <ExternalLink className="h-3.5 w-3.5" /> Pay link
                        </Button>
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {debtors.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-muted">
                    No outstanding invoices 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modal && (
        <ReminderModal
          reminder={modal.reminder}
          customer={modal.customer}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-1 text-xl font-extrabold text-ink", accent)}>{value}</div>
    </Card>
  );
}
