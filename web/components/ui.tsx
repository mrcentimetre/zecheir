import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

/* ── layout ─────────────────────────────────────────────────────────── */

/** A screen's body. Top padding clears the status bar (the installed app draws under it). */
export function Screen({ children, className, bar }: { children: ReactNode; className?: string; bar?: boolean }) {
  return (
    <main
      className={cn(
        "flex min-h-dvh flex-col gap-5 px-5 pt-[calc(env(safe-area-inset-top)+14px)]",
        bar ? "pb-[calc(env(safe-area-inset-bottom)+112px)]" : "pb-[calc(env(safe-area-inset-bottom)+20px)]",
        className
      )}
    >
      {children}
    </main>
  );
}

/** Round icon button (back, menu). */
export function IconButton({ href, label, children, onClick }: { href?: string; label: string; children: ReactNode; onClick?: () => void }) {
  const cls = "flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-foreground transition active:scale-90";
  return href ? (
    <Link href={href} aria-label={label} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function Avatar({ name, tone = "yellow", size = 48 }: { name: string; tone?: "yellow" | "indigo" | "paper"; size?: number }) {
  const tones = { yellow: "bg-primary text-primary-ink", indigo: "bg-indigo text-white", paper: "bg-paper text-paper-ink" };
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full font-extrabold", tones[tone])} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {name[0]?.toUpperCase()}
    </span>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13px] font-semibold text-muted-foreground", className)}>{children}</p>;
}

/* ── money ──────────────────────────────────────────────────────────── */

/** A ZEC amount: whole part bold, decimals dimmed, unit small. */
export function Amount({ zat, className, unit = "ZEC" }: { zat?: number | null; className?: string; unit?: string }) {
  if (zat == null) return <span className={cn("font-bold tabular-nums", className)}>—</span>;
  const [whole, frac] = (zat / 1e8).toFixed(zat % 1e6 === 0 ? 2 : 4).split(".");
  return (
    <span className={cn("font-bold tracking-[-0.03em] tabular-nums", className)}>
      {whole}
      <span className="opacity-40">.{frac}</span>
      {unit && <span className="ml-2 text-[0.38em] font-semibold tracking-normal opacity-60">{unit}</span>}
    </span>
  );
}

/* ── surfaces ───────────────────────────────────────────────────────── */

export function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[26px] bg-surface", className)}>{children}</div>;
}

export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-white/[0.06] overflow-hidden rounded-[26px] bg-surface", className)}>{children}</div>;
}

export function Row({ label, value, mono }: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="text-[15px] text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 truncate text-right text-[15px] font-semibold", mono && "font-mono text-[13px] font-medium")}>{value}</span>
    </div>
  );
}

export function Pill({ children, tone = "dark", className }: { children: ReactNode; tone?: "dark" | "yellow" | "alive" | "wait"; className?: string }) {
  const tones = {
    dark: "bg-surface-2 text-foreground",
    yellow: "bg-primary text-primary-ink",
    alive: "bg-alive/15 text-alive",
    wait: "bg-wait/15 text-wait",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold", tones[tone], className)}>{children}</span>;
}

/* ── buttons ────────────────────────────────────────────────────────── */

const variants = {
  primary: "bg-primary text-primary-ink hover:brightness-105",
  dark: "bg-surface-2 text-foreground hover:bg-surface-3",
  paper: "bg-paper text-paper-ink",
  ghost: "text-muted-foreground hover:text-foreground",
  wait: "bg-wait text-primary-ink",
} as const;
const sizes = { md: "h-[58px] px-6 text-[16px]", sm: "h-11 px-4 text-[14px]" } as const;
const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 outline-none focus-visible:ring-2 focus-visible:ring-primary/60";
const width = (c?: string) => (/(^|\s)w-/.test(c ?? "") ? "" : "w-full");
type BtnProps = { variant?: keyof typeof variants; size?: keyof typeof sizes };

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & BtnProps) {
  return <button className={cn(base, width(className), variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & BtnProps) {
  return <Link className={cn(base, width(className), variants[variant], sizes[size], className)} {...props} />;
}

/** Round action with a label under it. */
export function RoundAction({ icon, label, primary, href, onClick, disabled }: { icon: ReactNode; label: string; primary?: boolean; href?: string; onClick?: () => void; disabled?: boolean }) {
  const inner = (
    <>
      <span className={cn("flex size-[58px] items-center justify-center rounded-full transition group-active:scale-90", primary ? "bg-primary text-primary-ink" : "bg-surface-2 text-foreground")}>{icon}</span>
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
    </>
  );
  const cls = cn("group flex flex-col items-center gap-2", disabled && "pointer-events-none opacity-40");
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

/** Progress as discrete segments — a count you can read, not a vague glow. */
export function Segments({ total, done, running, tone = "yellow", className }: { total: number; done: number; running?: boolean; tone?: "yellow" | "alive" | "wait" | "ink"; className?: string }) {
  const fill = { yellow: "bg-primary", alive: "bg-alive", wait: "bg-wait", ink: "bg-paper-ink" }[tone];
  const empty = tone === "ink" ? "bg-paper-ink/15" : "bg-surface-3";
  return (
    <div className={cn("flex gap-1.5", className)} role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-2 flex-1 rounded-full transition-colors duration-500", i < done ? fill : i === done && running ? cn(fill, "zh-blink") : empty)} />
      ))}
    </div>
  );
}

/* ── states ─────────────────────────────────────────────────────────── */

export function Loading({ error }: { error: string | null }) {
  return (
    <Screen className="items-center justify-center">
      {error ? <ErrorNote message={error} /> : <span className="zh-blink text-[15px] font-semibold text-muted-foreground">Opening the vault…</span>}
    </Screen>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[20px] bg-block/12 px-4 py-3 text-[14px] leading-snug font-medium text-block">
      {message}
    </p>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect width="34" height="34" rx="11" fill="#F4B728" />
      <path d="M17 7.5l7.5 2.7v5.4c0 4.8-3.1 8.4-7.5 9.9-4.4-1.5-7.5-5.1-7.5-9.9v-5.4L17 7.5z" fill="#141210" />
      <circle cx="17" cy="15.4" r="2.1" fill="#F4B728" />
      <path d="M16 17h2l.6 4h-3.2l.6-4z" fill="#F4B728" />
    </svg>
  );
}
