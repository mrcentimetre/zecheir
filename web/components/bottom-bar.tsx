"use client";

import { Gift, Plus, Settings, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

/**
 * Bottom bar: four views of one vault, and "new vault" in the middle.
 * A blurred scrim sits under it, so content scrolling beneath never collides
 * with the bar's labels.
 */
export default function BottomBar({ id }: { id: string }) {
  const pathname = usePathname();
  const tab = (href: string, label: string, Icon: typeof Gift) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn("flex flex-1 flex-col items-center gap-1 py-1 transition", active ? "text-foreground" : "text-subtle")}
      >
        <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
        <span className="text-[11.5px] font-bold">{label}</span>
        <span className={cn("size-1 rounded-full", active ? "bg-primary" : "bg-transparent")} />
      </Link>
    );
  };

  return (
    <>
      {/* Scrim: blur + fade to the page colour, behind the bar. The mask lets the blur fade in, not start at a hard edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[440px] bg-gradient-to-t from-background via-background/80 to-transparent backdrop-blur-md"
        style={{
          height: "calc(env(safe-area-inset-bottom) + 132px)",
          maskImage: "linear-gradient(to top, black 55%, transparent)",
          WebkitMaskImage: "linear-gradient(to top, black 55%, transparent)",
        }}
      />
      <nav
        aria-label="Main"
        className="fixed inset-x-3 z-30 mx-auto flex max-w-[416px] items-end rounded-[28px] bg-surface/85 px-2 pt-2.5 pb-2 ring-1 ring-white/[0.06] backdrop-blur-xl"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        {tab(`/vault/${id}`, "Vault", ShieldCheck)}
        {tab(`/guardian/${id}`, "Guardian", Users)}
        <Link
          href="/setup"
          aria-label="New vault"
          className={cn(
            "-mt-8 flex size-[62px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-ink ring-[6px] ring-background transition active:scale-90",
            pathname === "/setup" && "ring-primary/30"
          )}
        >
          <Plus size={30} strokeWidth={2.8} aria-hidden />
        </Link>
        {tab(`/heir/${id}`, "Heir", Gift)}
        {tab(`/settings/${id}`, "Settings", Settings)}
      </nav>
    </>
  );
}
