import { useEffect, useState } from "react";
import { KeyRound, CheckCircle2, XCircle, Cpu, Bot, Mail, Sheet, Copy, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, Button, Badge } from "@/components/ui/primitives";
import { api, type RazorpayStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const APPS_SCRIPT = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var body = JSON.parse(e.postData.contents);
  if (body.replace) {
    sheet.clear();
    sheet.appendRow(body.header);
    (body.rows || []).forEach(function (r) { sheet.appendRow(r); });
  } else if (body.row) {
    sheet.appendRow(body.row);
  }
  return ContentService.createTextOutput("ok");
}`;

export function SettingsPage() {
  const [status, setStatus] = useState<RazorpayStatus | null>(null);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [demo, setDemo] = useState(true);

  // integrations
  const [smtp, setSmtp] = useState({ host: "", port: 587, username: "", password: "", from_email: "", from_name: "Artisan Coffee Co.", redirect_to: "aneeshdutt67@gmail.com" });
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [webhook, setWebhook] = useState("");
  const [sheetsEnabled, setSheetsEnabled] = useState(false);

  useEffect(() => {
    api.razorpayStatus().then((s) => { setStatus(s); setDemo(s.demo_mode); }).catch(() => {});
    api.integrations().then((d) => {
      setSmtpEnabled(d.smtp.enabled);
      setSmtp((s) => ({ ...s, host: d.smtp.host, port: d.smtp.port, from_email: d.smtp.from_email, from_name: d.smtp.from_name, redirect_to: d.smtp.redirect_to || s.redirect_to }));
      setSheetsEnabled(d.sheets.enabled);
      setWebhook(d.sheets.webhook_url);
    }).catch(() => {});
  }, []);

  async function saveRzp() {
    try {
      const s = await api.saveRazorpay({ key_id: keyId, key_secret: keySecret, demo_mode: demo });
      setStatus(s);
      toast.success(demo ? "Saved · demo mode" : "Credentials saved · live mode");
    } catch { toast.error("Could not save"); }
  }
  async function saveSmtp() {
    try { const r = await api.saveSmtp(smtp); setSmtpEnabled(r.enabled); toast.success(r.enabled ? "SMTP connected · emails will send for real" : "SMTP saved"); }
    catch { toast.error("Could not save SMTP"); }
  }
  function useGmailPreset() {
    setSmtp((s) => ({ ...s, host: "smtp.gmail.com", port: 587 }));
    toast.info("Gmail preset applied · use an App Password, not your login password");
  }
  async function sendTest() {
    setTesting(true);
    try {
      await api.saveSmtp(smtp); // persist first so the test uses latest creds
      const r = await api.testEmail(smtp.redirect_to || "aneeshdutt67@gmail.com");
      if (r.delivered) toast.success(`Test email delivered to ${r.delivered_to} 🎉`);
      else if (r.smtp_enabled) toast.error(`Send failed: ${r.error ?? "unknown error"}`);
      else toast.warning("Queued in Outbox — add SMTP credentials to deliver for real");
    } catch { toast.error("Test failed"); }
    finally { setTesting(false); }
  }
  async function saveSheets() {
    try { const r = await api.saveSheets(webhook); setSheetsEnabled(r.enabled); toast.success(r.enabled ? "Google Sheets connected" : "Webhook cleared"); }
    catch { toast.error("Could not save"); }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Razorpay */}
      <Card>
        <CardHeader>
          <CardTitle>Razorpay Connection</CardTitle>
          {status && <Badge variant={status.connected ? "success" : "danger"}>{status.connected ? "Connected" : "Disconnected"}</Badge>}
        </CardHeader>
        <div className="space-y-4">
          <Field label="Key ID"><input value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_test_xxxxxxxxxxxxx" className={inp} /></Field>
          <Field label="Key Secret"><input type="password" value={keySecret} onChange={(e) => setKeySecret(e.target.value)} placeholder="••••••••••••••••" className={inp} /></Field>
          <Toggle label="Demo mode" desc="Use realistic mock data — no keys required." on={demo} set={setDemo} />
          <div className="flex justify-end"><Button onClick={saveRzp}><KeyRound className="h-4 w-4" /> Save connection</Button></div>
        </div>
      </Card>

      {/* Email / SMTP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-brand" /> Email (SMTP)</CardTitle>
          <div className="flex items-center gap-2">
            <button onClick={useGmailPreset} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:bg-slate-50">Use Gmail preset</button>
            <Badge variant={smtpEnabled ? "success" : "default"}>{smtpEnabled ? "Live delivery" : "Outbox only"}</Badge>
          </div>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field label="SMTP host"><input value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.gmail.com" className={inp} /></Field>
          <Field label="Port"><input value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) || 587 })} className={inp} /></Field>
          <Field label="Username"><input value={smtp.username} onChange={(e) => setSmtp({ ...smtp, username: e.target.value })} placeholder="you@gmail.com" className={inp} /></Field>
          <Field label="App password"><input type="password" value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} placeholder="16-char Gmail app password" className={inp} /></Field>
          <Field label="From email"><input value={smtp.from_email} onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })} placeholder="you@gmail.com" className={inp} /></Field>
          <Field label="From name"><input value={smtp.from_name} onChange={(e) => setSmtp({ ...smtp, from_name: e.target.value })} className={inp} /></Field>
        </div>

        <div className="mt-4 rounded-xl border border-brand/20 bg-brand-light/60 p-3 dark:bg-brand/10">
          <Field label="Deliver all demo emails to (recipient override)">
            <input value={smtp.redirect_to} onChange={(e) => setSmtp({ ...smtp, redirect_to: e.target.value })} placeholder="aneeshdutt67@gmail.com" className={inp} />
          </Field>
          <p className="mt-2 text-[11px] text-muted">
            Every reminder & receipt will be delivered to this inbox (great for demos). Leave the customer's
            real address in production. <b>aneeshdutt67@gmail.com</b> is pre-filled.
          </p>
        </div>

        <p className="mt-3 text-xs text-muted">
          Reminders & receipts always appear in the in-app Outbox. Add Gmail SMTP (host <span className="font-mono">smtp.gmail.com</span>,
          an <a className="text-brand underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">App Password</a>) to deliver them for real.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={sendTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test email
          </Button>
          <Button onClick={saveSmtp}>Save email settings</Button>
        </div>
      </Card>

      {/* Google Sheets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sheet className="h-4 w-4 text-success" /> Google Sheets Sync</CardTitle>
          <Badge variant={sheetsEnabled ? "success" : "default"}>{sheetsEnabled ? "Connected" : "Not connected"}</Badge>
        </CardHeader>
        <Field label="Apps Script Web App URL">
          <input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className={inp} />
        </Field>
        <div className="mt-3 rounded-xl bg-slate-900 p-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>1. Extensions → Apps Script, paste this, Deploy as Web App (access: Anyone):</span>
            <button onClick={() => { navigator.clipboard?.writeText(APPS_SCRIPT); toast.success("Script copied"); }} className="flex items-center gap-1 text-slate-300 hover:text-white"><Copy className="h-3 w-3" /> copy</button>
          </div>
          <pre className="scroll-thin overflow-x-auto text-[11px] leading-relaxed text-emerald-300">{APPS_SCRIPT}</pre>
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={saveSheets}>Save Sheets sync</Button></div>
      </Card>

      {/* System status */}
      {status && (
        <Card>
          <CardHeader><CardTitle>System Status</CardTitle></CardHeader>
          <div className="space-y-3 text-sm">
            <Row ok={status.connected} label="Razorpay" value={status.merchant_name} />
            <Row ok={status.llm_enabled} label="Claude agents" value={status.llm_enabled ? `Live · ${status.model}` : "Offline templates (no API key)"} icon={<Bot className="h-4 w-4 text-muted" />} />
            <Row ok label="Model" value={status.model} icon={<Cpu className="h-4 w-4 text-muted" />} />
            <Row ok={smtpEnabled} label="Email delivery" value={smtpEnabled ? "SMTP live" : "Outbox only"} icon={<Mail className="h-4 w-4 text-muted" />} />
            <Row ok={sheetsEnabled} label="Sheets sync" value={sheetsEnabled ? "Connected" : "Off"} icon={<Sheet className="h-4 w-4 text-muted" />} />
          </div>
        </Card>
      )}
    </div>
  );
}

const inp = "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-mono outline-none focus:border-brand focus:ring-4 focus:ring-brand/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">{label}</label>{children}</div>);
}
function Toggle({ label, desc, on, set }: { label: string; desc: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border bg-slate-50/50 px-4 py-3">
      <div><div className="text-sm font-medium text-ink">{label}</div><div className="text-xs text-muted">{desc}</div></div>
      <button type="button" onClick={() => set(!on)} className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-brand" : "bg-slate-300")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </label>
  );
}
function Row({ ok, label, value, icon }: { ok: boolean; label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 text-muted">
        {icon ?? (ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />)}
        {label}
      </div>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
