// Theme-aware Recharts tooltip styling. Uses the same CSS variables the rest
// of the app flips, so tooltips follow light/dark without any JS theme reads.
export const tooltipContentStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgb(var(--c-border))",
  background: "rgb(var(--c-card))",
  boxShadow: "0 10px 30px -14px rgb(10 16 32 / 0.4)",
  fontSize: 12,
};
export const tooltipItemStyle: React.CSSProperties = { color: "rgb(var(--c-ink))" };
export const tooltipLabelStyle: React.CSSProperties = { color: "rgb(var(--c-muted))", fontWeight: 600 };
export const tooltipCursor = { fill: "rgb(148 163 184 / 0.12)" };
