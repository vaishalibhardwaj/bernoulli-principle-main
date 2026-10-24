// Formatting + shared helpers

export function maskAccount(acc) {
  if (!acc) return "—";
  const s = String(acc);
  if (s.length <= 4) return "XXXX" + s;
  return "XXXX" + s.slice(-4);
}

export function formatINR(n) {
  if (n == null || isNaN(n)) return "—";
  const neg = n < 0;
  const x = Math.abs(n).toFixed(2);
  const [whole, frac] = x.split(".");
  let last3 = whole.slice(-3);
  let rest = whole.slice(0, -3);
  if (rest) last3 = "," + last3;
  rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (neg ? "-₹" : "₹") + rest + last3 + "." + frac;
}

export function formatDate(d) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " + dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function genUTR() {
  const banks = ["HDFC", "ICIC", "SBIN", "UTIB", "KKBK"];
  const b = banks[Math.floor(Math.random() * banks.length)];
  return b + "R" + Math.floor(1e11 + Math.random() * 9e11);
}

export function highlight(text, query) {
  if (!query) return text;
  const s = String(text);
  const idx = s.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return [
    s.slice(0, idx),
    <mark key="m">{s.slice(idx, idx + query.length)}</mark>,
    s.slice(idx + query.length),
  ];
}

export function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}
