export function formatDuration(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${hours}h${String(minutes).padStart(2, "0")}min`;
  }
  const s = String(value).trim();
  // Pure digits (e.g. "90") -> treat as minutes
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    const hours = Math.floor(n / 60);
    const minutes = n % 60;
    return `${hours}h${String(minutes).padStart(2, "0")}min`;
  }
  // Match formats like "1h30min", "1h 30min", "90min" etc. Return as-is when plausible.
  if (/^\d+h/.test(s) || /min$/.test(s)) return s;
  // Fallback: return the raw string
  return s;
}

export function durationToMinutes(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const s = String(value).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // Match "1h30min" or "1h 30min"
  const m = s.match(/(?:(\d+)\s*h)\s*(\d+)\s*min/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const m2 = s.match(/(\d+)\s*h/);
  if (m2) return Number(m2[1]) * 60;
  const m3 = s.match(/(\d+)\s*min/);
  if (m3) return Number(m3[1]);
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}
