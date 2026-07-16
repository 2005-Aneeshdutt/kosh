import { useEffect, useState } from "react";
import { KeyRound, CheckCircle2, XCircle, Cpu, Bot } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, Button, Badge } from "@/components/ui/primitives";
import { api, type RazorpayStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const [status, setStatus] = useState<RazorpayStatus | null>(null);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [demo, setDemo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.razorpayStatus().then((s) => {
      setStatus(s);
      setDemo(s.demo_mode);
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const s = await api.saveRazorpay({ key_id: keyId, key_secret: keySecret, demo_mode: demo });
      setStatus(s);
      toast.success(demo ? "Saved · running in demo mode" : "Credentials saved · live mode");
    } catch {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Razorpay Connection</CardTitle>
          {status && (
            <Badge variant={status.connected ? "success" : "danger"}>
              {status.connected ? "Connected" : "Disconnected"}
            </Badge>
          )}
        </CardHeader>

        <div className="space-y-4">
          <Field label="Key ID">
            <input
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="rzp_test_xxxxxxxxxxxxx"
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-brand/30"
            />
          </Field>
          <Field label="Key Secret">
            <input
              type="password"
              value={keySecret}
              onChange={(e) => setKeySecret(e.target.value)}
              placeholder="••••••••••••••••••••••"
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-brand/30"
            />
          </Field>

          <label className="flex items-center justify-between rounded-xl border border-border bg-slate-50/50 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-ink">Demo mode</div>
              <div className="text-xs text-muted">Use realistic mock data — no keys required.</div>
            </div>
            <button
              onClick={() => setDemo((d) => !d)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                demo ? "bg-brand" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                  demo ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </label>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              <KeyRound className="h-4 w-4" /> Save connection
            </Button>
          </div>
        </div>
      </Card>

      {status && (
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <div className="space-y-3 text-sm">
            <StatusRow ok={status.connected} label="Razorpay" value={status.merchant_name} />
            <StatusRow
              ok={status.llm_enabled}
              label="Claude agents"
              value={status.llm_enabled ? `Live · ${status.model}` : "Offline templates (no API key)"}
              icon={<Bot className="h-4 w-4 text-muted" />}
            />
            <StatusRow
              ok
              label="Model"
              value={status.model}
              icon={<Cpu className="h-4 w-4 text-muted" />}
            />
          </div>
          {!status.llm_enabled && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              Tip: set <code className="font-mono">ANTHROPIC_API_KEY</code> in <code>.env</code> to
              get live Claude-authored reminders, summaries and insights. Everything works without
              it — the agents fall back to templates.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusRow({
  ok,
  label,
  value,
  icon,
}: {
  ok: boolean;
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 text-muted">
        {icon ?? (ok ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-danger" />
        ))}
        {label}
      </div>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
