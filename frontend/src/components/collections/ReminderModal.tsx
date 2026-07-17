import { motion } from "framer-motion";
import { X, Copy, Link2, Sparkles, CheckCircle2, Inbox, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button, Badge } from "@/components/ui/primitives";
import type { ReminderResponse } from "@/lib/api";

const TONE_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  friendly: "success",
  firm: "warning",
  urgent: "danger",
};

export function ReminderModal({
  reminder,
  customer,
  onClose,
}: {
  reminder: ReminderResponse;
  customer: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <h3 className="text-lg font-bold text-ink">
                {reminder.email_delivered ? "Reminder sent" : "Reminder queued"}
              </h3>
            </div>
            <p className="mt-0.5 text-sm text-muted">
              To {customer} · reminder #{reminder.reminders_sent}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Badge variant={TONE_VARIANT[reminder.tone] ?? "default"}>{reminder.tone} tone</Badge>
        </div>

        <div className="mt-3 whitespace-pre-line rounded-xl border border-border bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          {reminder.message}
        </div>

        {reminder.payment_link_url && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand/20 bg-blue-50/50 px-3 py-2.5 text-sm">
            <Link2 className="h-4 w-4 shrink-0 text-brand" />
            <span className="truncate font-mono text-xs text-brand-dark">
              {reminder.payment_link_url}
            </span>
            <button
              className="ml-auto shrink-0 rounded-lg p-1.5 text-muted hover:bg-white"
              onClick={() => {
                navigator.clipboard?.writeText(reminder.payment_link_url!);
                toast.success("Payment link copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Honest delivery status — the email is dispatched the moment you hit
            "Remind", so this reports what actually happened. */}
        <div
          className={
            "mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm " +
            (reminder.email_delivered
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700")
          }
        >
          {reminder.email_delivered ? (
            <>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <b>Delivered.</b> This email has been sent for real — check the inbox.
              </span>
            </>
          ) : (
            <>
              <Inbox className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <b>Queued in the Outbox.</b> Add SMTP credentials under
                Settings&nbsp;→&nbsp;Email to deliver reminders for real.
              </span>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {reminder.payment_link_url && (
            <a href={reminder.payment_link_url} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="h-4 w-4" /> Open pay page
              </Button>
            </a>
          )}
          <Button onClick={onClose}>Done</Button>
        </div>
      </motion.div>
    </div>
  );
}
