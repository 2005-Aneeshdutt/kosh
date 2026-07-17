import { useEffect, useMemo, useState } from "react";
import { Mail, CheckCircle2, Clock, Send, Inbox } from "lucide-react";
import { Card, Badge } from "@/components/ui/primitives";
import { api, type EmailSummary } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useLive } from "@/context/LiveContext";
import { cn } from "@/lib/utils";

const KIND_VARIANT: Record<string, "brand" | "success" | "warning"> = {
  reminder: "warning",
  receipt: "success",
};

export function MailPage() {
  const { events } = useLive();
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [html, setHtml] = useState<string>("");

  const emailEventCount = useMemo(() => events.filter((e) => e.kind === "email").length, [events]);

  useEffect(() => {
    api.mailOutbox().then((d) => {
      setEmails(d.emails);
      if (!selected && d.emails.length) setSelected(d.emails[0].id);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailEventCount]);

  useEffect(() => {
    if (!selected) return;
    api.mailDetail(selected).then((m) => setHtml(m.html)).catch(() => setHtml(""));
  }, [selected]);

  const delivered = emails.filter((e) => e.delivered).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Emails sent" value={String(emails.length)} icon={<Send className="h-4 w-4 text-brand" />} />
        <Stat label="Delivered (SMTP)" value={String(delivered)} icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
        <Stat label="Reminders" value={String(emails.filter((e) => e.kind === "reminder").length)} icon={<Mail className="h-4 w-4 text-warning" />} />
        <Stat label="Receipts" value={String(emails.filter((e) => e.kind === "receipt").length)} icon={<Inbox className="h-4 w-4 text-oracle" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        {/* List */}
        <Card className="p-0">
          <div className="border-b border-border px-5 py-3.5 text-sm font-semibold text-ink">Outbox</div>
          <div className="scroll-thin overflow-y-auto" style={{ maxHeight: 560 }}>
            {emails.length === 0 && (
              <div className="p-8 text-center text-sm text-muted">
                No emails yet. Run the agents or send a reminder to populate the outbox.
              </div>
            )}
            {emails.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e.id)}
                className={cn(
                  "flex w-full flex-col gap-1 border-b border-slate-50 px-5 py-3 text-left transition hover:bg-slate-50",
                  selected === e.id && "bg-brand-light"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{e.to_name}</span>
                  <Badge variant={KIND_VARIANT[e.kind] ?? "brand"}>{e.kind}</Badge>
                </div>
                <div className="truncate text-xs text-muted">{e.subject}</div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  {e.delivered ? (
                    <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> delivered</span>
                  ) : (
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> queued in outbox</span>
                  )}
                  · {timeAgo(e.sent_at)}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Preview */}
        <Card className="flex flex-col overflow-hidden p-0">
          <div className="border-b border-border px-5 py-3.5 text-sm font-semibold text-ink">Preview</div>
          {html ? (
            // Our own generated HTML. allow-popups lets the "Pay now" button open
            // the checkout in a new tab straight from the preview.
            <iframe
              title="email"
              srcDoc={html}
              className="min-h-[520px] w-full flex-1 bg-slate-100"
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted">
              Select an email to preview.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="rounded-xl bg-slate-50 p-2">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <div className="font-display text-xl font-extrabold text-ink">{value}</div>
      </div>
    </Card>
  );
}
