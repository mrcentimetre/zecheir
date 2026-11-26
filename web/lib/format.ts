/** "0:23", "4:05:12", "3d 04:12" — a ticking clock, at a glance. */
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${p(h)}:${p(m)}`;
  if (h > 0) return `${h}:${p(m)}:${p(sec)}`;
  return `${m}:${p(sec)}`;
}

/** "30 s", "7 days" */
export function every(sec: number) {
  if (sec % 86400 === 0) return `${sec / 86400} ${sec === 86400 ? "day" : "days"}`;
  if (sec % 60 === 0 && sec >= 60) return `${sec / 60} min`;
  return `${sec} s`;
}

export const short = (s?: string, head = 10, tail = 6) => (s ? `${s.slice(0, head)}…${s.slice(-tail)}` : "");
