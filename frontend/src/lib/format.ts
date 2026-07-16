/** Format paisa as Indian-grouped rupees, e.g. 12000000 -> "₹1,20,000". */
export function formatPaisa(paisa: number, opts: { compact?: boolean } = {}): string {
  const rupees = paisa / 100;
  if (opts.compact) return formatCompactRupees(rupees);
  return "₹" + rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** Compact Indian rupees, e.g. 1200000 -> "₹12.0L", 25000000 -> "₹2.5Cr". */
export function formatCompactRupees(rupees: number): string {
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export function formatPaisaCompact(paisa: number): string {
  return formatCompactRupees(paisa / 100);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const secs = Math.round((Date.now() - d) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
