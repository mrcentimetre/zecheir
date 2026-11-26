"use client";

import { Check, ChevronLeft, Copy, EyeOff, Unlock } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import BottomBar from "@/components/bottom-bar";
import { RecordedNote, Amount, Avatar, IconButton, Loading, Rows, Screen, Tile } from "@/components/ui";
import { useVault } from "@/lib/use-vault";

export default function Heir() {
  const { id } = useParams<{ id: string }>();
  const { vault, error } = useVault(id, { intervalMs: 4000 });
  const [copied, setCopied] = useState(false);
  if (!vault) return <Loading error={error} />;

  const released = !!vault.release?.txid;

  return (
    <Screen bar>
      <header className="flex items-center gap-3">
        <IconButton href={`/vault/${vault.id}`} label="Back to the vault">
          <ChevronLeft size={22} aria-hidden />
        </IconButton>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[14px] font-medium text-muted-foreground">Heir</p>
          <p className="text-[19px] font-extrabold tracking-[-0.02em]">For {vault.heir.name}</p>
        </div>
        <Avatar name={vault.heir.name} tone="paper" />
      </header>
      <RecordedNote show={vault.recorded} />

      <h1 className="mt-1 text-[32px] leading-[1.05] font-extrabold tracking-[-0.035em]">
        {released ? `${vault.owner} left you something.` : `${vault.owner} named you as heir.`}
      </h1>

      {released ? (
        <>
          <div className="flex flex-col">
            <div className="rounded-[28px] bg-indigo px-5 pt-5 pb-10 text-white">
              <p className="text-[13px] font-bold opacity-70">Sent privately</p>
              <Amount zat={vault.release?.amountZat ?? null} className="mt-1 block text-[46px] leading-none" />
              <p className="mt-2 text-[14px] font-semibold opacity-80">Shielded, to your own Zcash wallet</p>
            </div>
            {vault.memo && (
              <div className="relative -mt-6 rounded-[28px] bg-paper p-5 text-paper-ink">
                <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-paper-ink/20" />
                <p className="pt-1.5 text-[12.5px] font-bold opacity-55">A note from {vault.owner}</p>
                <p className="mt-2 text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]">“{vault.memo}”</p>
                <p className="mt-3 text-[13px] font-semibold opacity-55">Inside the encrypted memo. Only your wallet can read it.</p>
              </div>
            )}
          </div>

          <Rows>
            <div className="flex items-center gap-3.5 px-5 py-4">
              <EyeOff size={19} className="shrink-0 text-primary" aria-hidden />
              <p className="text-[14.5px] leading-snug font-medium">Nobody else can see the amount, who sent it, or why.</p>
            </div>
            <div className="flex items-center gap-3.5 px-5 py-4">
              <Unlock size={19} className="shrink-0 text-primary" aria-hidden />
              <p className="text-[14.5px] leading-snug font-medium">It&apos;s fully yours. ZecHeir and {vault.guardian} have no say over it.</p>
            </div>
          </Rows>

          <Tile className="flex items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-muted-foreground">Transaction</p>
              <p className="truncate font-mono text-[12.5px]">{vault.release!.txid}</p>
            </div>
            <button
              type="button"
              aria-label="Copy transaction ID"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2"
              onClick={async () => {
                await navigator.clipboard.writeText(vault.release!.txid!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={17} className="text-alive" /> : <Copy size={17} />}
            </button>
          </Tile>
        </>
      ) : (
        <Tile className="p-5">
          <p className="text-[16px] leading-snug font-semibold">Nothing to do right now.</p>
          <p className="mt-2 text-[14.5px] leading-snug text-muted-foreground">
            If {vault.owner} stops checking in, {vault.guardian} can release the vault to you after a grace period. It arrives shielded, with a private note
            from {vault.owner} inside.
          </p>
        </Tile>
      )}

      <BottomBar id={vault.id} />
    </Screen>
  );
}
