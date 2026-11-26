import type { ReactNode } from "react";
import { cn } from "./ui";

/**
 * The vault's key, as three cards stacked like a wallet: each share holder owns
 * a solid colour (owner yellow, guardian indigo, switch paper). Earlier cards
 * show only their header strip; the last card is fully open.
 */
export function ShareStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}

const TONES = {
  yellow: "bg-primary text-primary-ink",
  indigo: "bg-indigo text-white",
  paper: "bg-paper text-paper-ink",
} as const;

export function ShareCard({
  tone,
  title,
  kicker,
  right,
  children,
  first,
}: {
  tone: keyof typeof TONES;
  title: string;
  kicker: string;
  right?: ReactNode;
  children?: ReactNode;
  first?: boolean;
}) {
  return (
    <div className={cn("relative rounded-[28px] px-5 pt-4", TONES[tone], first ? "" : "-mt-5", children ? "pb-5" : "pb-9")}>
      {/* the little grip on each card, like a tab you could pull */}
      <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-current opacity-20" />
      <div className="flex items-start justify-between gap-3 pt-1.5">
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold opacity-60">{kicker}</p>
          <p className="truncate text-[21px] leading-tight font-extrabold tracking-[-0.02em]">{title}</p>
        </div>
        {right && <div className="shrink-0 text-right">{right}</div>}
      </div>
      {children}
    </div>
  );
}
