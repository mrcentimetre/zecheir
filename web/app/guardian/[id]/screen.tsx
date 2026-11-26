"use client";

import { ArrowRight, Check, ChevronLeft, Copy, LoaderCircle, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import BottomBar from "@/components/bottom-bar";
import { RecordedNote, Amount, Avatar, Button, ButtonLink, ErrorNote, IconButton, Label, Loading, Row, Rows, Screen, Segments, Tile, cn } from "@/components/ui";
import { api, type ReleaseStep, type VaultView } from "@/lib/api";
import { short } from "@/lib/format";
import { useVault } from "@/lib/use-vault";

export default function Guardian() {
  const { id } = useParams<{ id: string }>();
  const { vault, setVault, error } = useVault(id, { intervalMs: 1500 });
  if (!vault) return <Loading error={error} />;
  return (
    <Screen bar>
      <header className="flex items-center gap-3">
        <IconButton href={`/vault/${vault.id}`} label="Back to the vault">
          <ChevronLeft size={22} aria-hidden />
        </IconButton>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[14px] font-medium text-muted-foreground">Guardian · {vault.guardian}</p>
          <p className="text-[19px] font-extrabold tracking-[-0.02em]">{vault.owner}&apos;s vault</p>
        </div>
        <Avatar name={vault.guardian} tone="indigo" />
      </header>
      <RecordedNote show={vault.recorded} />
      {vault.release ? <Signing vault={vault} setVault={setVault} /> : <Approve vault={vault} setVault={setVault} />}
      <BottomBar id={vault.id} />
    </Screen>
  );
}

function Approve({ vault, setVault }: { vault: VaultView; setVault: (v: VaultView) => void }) {
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const releasable = vault.status.phase === "releasable";

  async function approve() {
    setBusy(true);
    setErr(null);
    try {
      setVault(await api.approve(vault.id));
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="mt-1 text-[32px] leading-[1.05] font-extrabold tracking-[-0.035em]">
        {releasable ? `Release it to ${vault.heir.name}?` : "Nothing to approve yet"}
      </h1>

      <div className="rounded-[28px] bg-primary p-5 text-primary-ink">
        <p className="text-[13px] font-bold opacity-60">The pre-agreed payment</p>
        <Amount zat={vault.balance?.totalZat ?? null} className="mt-1 block text-[44px] leading-none" />
        <div className="mt-5 flex items-center gap-2.5">
          <Avatar name={vault.owner} tone="paper" size={36} />
          <ArrowRight size={18} strokeWidth={2.6} aria-hidden />
          <Avatar name={vault.heir.name} tone="paper" size={36} />
          <p className="ml-1 text-[14.5px] leading-tight font-bold">
            Everything, from {vault.owner} to {vault.heir.name}
          </p>
        </div>
      </div>

      {!releasable && (
        <p className="rounded-[22px] bg-wait/12 px-4 py-3.5 text-[14px] leading-snug font-medium text-wait">
          The vault is {vault.status.phase}. You can approve only after {vault.owner} misses {vault.schedule.missLimit} check-ins and the grace period ends.
        </p>
      )}

      <Rows>
        <Row label="Heir address" value={short(vault.heir.address, 10, 6)} mono />
        <Row label="Private note" value="Encrypted, inside" />
        <Row label="Signers" value="You + the switch" />
      </Rows>

      <section className={cn("flex flex-col gap-3", !releasable && "opacity-40")}>
        <Label>Before you approve</Label>
        <Rows>
          <label className="flex cursor-pointer items-center gap-3.5 px-5 py-4 text-[15px] leading-snug font-medium">
            <input type="checkbox" className="zh-check" checked={c1} disabled={!releasable} onChange={() => setC1(!c1)} />
            I tried to reach {vault.owner} and couldn&apos;t
          </label>
          <label className="flex cursor-pointer items-center gap-3.5 px-5 py-4 text-[15px] leading-snug font-medium">
            <input type="checkbox" className="zh-check" checked={c2} disabled={!releasable} onChange={() => setC2(!c2)} />
            I understand this can&apos;t be undone
          </label>
        </Rows>
      </section>

      <ErrorNote message={err} />
      <div className="flex flex-col gap-1">
        <Button onClick={approve} disabled={!releasable || !c1 || !c2 || busy}>
          {busy && <LoaderCircle size={18} className="animate-spin" aria-hidden />} Approve and sign
        </Button>
        <ButtonLink href={`/vault/${vault.id}`} variant="ghost" size="sm">
          {vault.owner} is fine, go back
        </ButtonLink>
      </div>
    </>
  );
}

function Signing({ vault, setVault }: { vault: VaultView; setVault: (v: VaultView) => void }) {
  const release = vault.release!;
  const steps: ReleaseStep[] = release.steps.length ? release.steps : [{ key: "create", label: "Starting…", status: "running" }];
  const total = Math.max(steps.length, 8);
  const done = steps.filter((s) => s.status === "done").length;
  const failed = !!release.error;
  const finished = !!release.txid;
  const [copied, setCopied] = useState(false);

  return (
    <>
      {finished ? (
        <div className="rounded-[28px] bg-primary p-5 text-primary-ink">
          <p className="text-[13px] font-bold opacity-60">Sent to {vault.heir.name}</p>
          <Amount zat={release.amountZat ?? null} className="mt-1 block text-[44px] leading-none" />
          <p className="mt-4 text-[14.5px] leading-snug font-bold">Two shares signed together. Nobody ever held the whole key.</p>
        </div>
      ) : (
        <Tile className="p-5">
          <p className="text-[13px] font-bold text-muted-foreground">{failed ? "Signing stopped" : "FROST signing · 2 of 3"}</p>
          <p className="mt-1 text-[50px] leading-none font-extrabold tracking-[-0.04em] tabular-nums">
            {done}
            <span className="text-subtle"> / {total}</span>
          </p>
          <Segments className="mt-4" total={total} done={done} running={!failed} tone={failed ? "wait" : "yellow"} />
          <p className="mt-4 text-[14px] leading-snug font-medium text-muted-foreground">
            {failed ? "Nothing was sent. The funds are still in the vault." : `${vault.guardian} and the switch are signing. Nobody holds the whole key.`}
          </p>
        </Tile>
      )}

      <Rows>
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3.5 px-5 py-3.5">
            <StepMark status={s.status} n={i + 1} />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[15px] font-bold", s.status === "pending" && "text-subtle", s.status === "running" && "text-primary")}>{s.label}</p>
              {s.detail && <p className="truncate font-mono text-[11.5px] text-muted-foreground">{s.detail}</p>}
            </div>
          </div>
        ))}
      </Rows>

      {failed && (
        <>
          <ErrorNote message={release.error!} />
          <Button variant="dark" onClick={async () => setVault(await api.resetRelease(vault.id))}>
            Reset and try again
          </Button>
        </>
      )}

      {finished && (
        <>
          <Tile className="flex items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-muted-foreground">Transaction</p>
              <p className="truncate font-mono text-[12.5px]">{release.txid}</p>
            </div>
            <button
              type="button"
              aria-label="Copy transaction ID"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2"
              onClick={async () => {
                await navigator.clipboard.writeText(release.txid!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={17} className="text-alive" /> : <Copy size={17} />}
            </button>
          </Tile>
          <ButtonLink href={`/heir/${vault.id}`}>
            See what {vault.heir.name} received <ArrowRight size={18} strokeWidth={2.4} aria-hidden />
          </ButtonLink>
        </>
      )}
    </>
  );
}

function StepMark({ status, n }: { status: ReleaseStep["status"]; n: number }) {
  const base = "flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold";
  if (status === "done")
    return (
      <span className={cn(base, "bg-primary text-primary-ink")}>
        <Check size={16} strokeWidth={3} />
      </span>
    );
  if (status === "running")
    return (
      <span className={cn(base, "bg-surface-3 text-primary")}>
        <LoaderCircle size={16} strokeWidth={2.8} className="animate-spin" />
      </span>
    );
  if (status === "failed")
    return (
      <span className={cn(base, "bg-block text-primary-ink")}>
        <X size={16} strokeWidth={3} />
      </span>
    );
  return <span className={cn(base, "bg-surface-2 text-subtle")}>{n}</span>;
}
