"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import BottomBar from "@/components/bottom-bar";
import { Avatar, IconButton, Label, Loading, Row, Rows, Screen, cn } from "@/components/ui";
import { api, type VaultView } from "@/lib/api";
import { every, short } from "@/lib/format";
import { useVault } from "@/lib/use-vault";

export default function SettingsScreen() {
  const { id } = useParams<{ id: string }>();
  const { vault, error } = useVault(id, { intervalMs: 10_000, balanceEveryMs: 120_000 });
  const [vaults, setVaults] = useState<VaultView[] | null>(null);
  const [frost, setFrost] = useState<"checking" | "online" | "offline">("checking");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.vaults().then(setVaults).catch(() => setVaults([]));
    api.health().then((h) => setFrost(h.ok && h.frostd ? "online" : "offline")).catch(() => setFrost("offline"));
  }, []);

  if (!vault) return <Loading error={error} />;

  const copy = async (key: string, text?: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Screen bar>
      <header className="flex items-center gap-3">
        <IconButton href={`/vault/${vault.id}`} label="Back to the vault">
          <ChevronLeft size={22} aria-hidden />
        </IconButton>
        <p className="text-[19px] font-extrabold tracking-[-0.02em]">Settings</p>
      </header>

      <section className="flex flex-col gap-2.5">
        <Label>This vault</Label>
        <Rows>
          <Row label="Owner" value={vault.owner} />
          <Row label="Check in every" value={every(vault.schedule.checkinPeriodSec)} />
          <Row label="Release after" value={`${vault.schedule.missLimit} misses + ${every(vault.schedule.graceSec)}`} />
          <CopyRow label="Vault address" text={vault.vaultAddress} copied={copied === "addr"} onCopy={() => copy("addr", vault.vaultAddress)} />
          <CopyRow label="FROST group key" text={vault.groupPubKey} copied={copied === "key"} onCopy={() => copy("key", vault.groupPubKey)} />
        </Rows>
      </section>

      <section className="flex flex-col gap-2.5">
        <Label>Network</Label>
        <Rows>
          <Row label="Chain" value="Zcash testnet" />
          <Row label="Wallet server" value="testnet.zec.rocks" />
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <span className="text-[15px] text-muted-foreground">FROST server</span>
            <span className={cn("inline-flex items-center gap-2 text-[15px] font-semibold", frost === "online" ? "text-alive" : frost === "offline" ? "text-block" : "text-muted-foreground")}>
              <span className={cn("size-2 rounded-full bg-current", frost === "checking" && "zh-blink")} />
              {frost === "online" ? "Online" : frost === "offline" ? "Offline" : "Checking"}
            </span>
          </div>
        </Rows>
      </section>

      {vaults && vaults.length > 1 && (
        <section className="flex flex-col gap-2.5">
          <Label>Your vaults</Label>
          <Rows>
            {vaults.map((v) => (
              <Link key={v.id} href={`/vault/${v.id}`} className="flex items-center gap-3.5 px-5 py-3.5 transition active:bg-surface-2">
                <Avatar name={v.owner} size={38} tone={v.id === vault.id ? "yellow" : "paper"} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">
                    {v.owner} → {v.heir.name}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {v.status.phase} · {v.id}
                  </p>
                </div>
                <ChevronRight size={18} className="text-subtle" aria-hidden />
              </Link>
            ))}
          </Rows>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <Label>About</Label>
        <div className="rounded-[26px] bg-surface p-5 text-[14.5px] leading-snug text-muted-foreground">
          <p className="font-bold text-foreground">ZecHeir · testnet MVP</p>
          <p className="mt-1.5">
            Built for the Zcash India bounty. Not audited: use testnet coins only. FROST tooling by the Zcash Foundation, wallet by zcash-devtool. MIT licensed.
          </p>
          <p className="mt-3">To install on iPhone: Safari → Share → Add to Home Screen.</p>
        </div>
      </section>

      <BottomBar id={vault.id} />
    </Screen>
  );
}

function CopyRow({ label, text, copied, onCopy }: { label: string; text?: string; copied: boolean; onCopy: () => void }) {
  return (
    <button type="button" onClick={onCopy} disabled={!text} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition active:bg-surface-2">
      <span className="text-[15px] text-muted-foreground">{label}</span>
      <span className="inline-flex min-w-0 items-center gap-2 font-mono text-[13px]">
        <span className="truncate">{text ? short(text, 8, 6) : "—"}</span>
        {copied && <Check size={15} className="shrink-0 text-alive" aria-hidden />}
      </span>
    </button>
  );
}
