"use client";

import { Check, ChevronRight, Copy, FastForward, Link2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import BottomBar from "@/components/bottom-bar";
import { ShareCard, ShareStack } from "@/components/share-stack";
import { RecordedNote, Amount, Avatar, Button, ButtonLink, ErrorNote, Label, Loading, Pill, RoundAction, Screen, Segments, Tile, cn } from "@/components/ui";
import { api, type VaultView } from "@/lib/api";
import { clock, every, short } from "@/lib/format";
import { useVault } from "@/lib/use-vault";

export default function VaultHome() {
  const { id } = useParams<{ id: string }>();
  const { vault, setVault, error, now } = useVault(id);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState(false);
  const [justChecked, setJustChecked] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!vault) return <Loading error={error} />;

  async function act(fn: () => Promise<VaultView>) {
    setBusy(true);
    setActionError(null);
    try {
      setVault(await fn());
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function checkIn() {
    await act(() => api.checkIn(id));
    setJustChecked(true);
    setTimeout(() => setJustChecked(false), 1800);
  }
  async function copyGuardianLink() {
    await navigator.clipboard.writeText(`${location.origin}/guardian/${id}`);
    setInvited(true);
    setTimeout(() => setInvited(false), 1800);
  }
  async function copyAddress() {
    if (!vault?.vaultAddress) return;
    await navigator.clipboard.writeText(vault.vaultAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const { status: s, schedule } = vault;
  const done = s.phase === "released" || s.phase === "signing";
  const grace = s.phase === "grace" || s.phase === "releasable";
  const canCheckIn = !done && s.phase !== "releasable";
  const skipAhead = () =>
    act(() =>
      api.fastForward(vault.id, grace ? schedule.missLimit + schedule.graceSec / schedule.checkinPeriodSec + 0.1 : schedule.missLimit)
    );

  return (
    <Screen bar>
      <header className="flex items-center gap-3">
        <Avatar name={vault.owner} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[14px] font-medium text-muted-foreground">Hello, {vault.owner}</p>
          <p className="text-[19px] font-extrabold tracking-[-0.02em]">Your vault</p>
        </div>
        <PhasePill phase={s.phase} />
      </header>
      <RecordedNote show={vault.recorded} />

      <section className="mt-2">
        <Label>{done ? `Released to ${vault.heir.name}` : "Vault balance"}</Label>
        <Amount zat={done ? (vault.release?.amountZat ?? null) : (vault.balance?.totalZat ?? null)} className="mt-1 block text-[50px] leading-none" />
        <p className="mt-2 text-[14px] font-medium text-muted-foreground">Shielded · check in every {every(schedule.checkinPeriodSec)}</p>
      </section>

      <div className="grid grid-cols-4">
        <RoundAction
          primary
          label={justChecked ? "Done" : "Check in"}
          icon={<Check size={26} strokeWidth={3} />}
          onClick={checkIn}
          disabled={busy || !canCheckIn}
        />
        <RoundAction label={copied ? "Copied" : "Fund"} icon={<Copy size={21} strokeWidth={2.2} />} onClick={copyAddress} />
        <RoundAction label={invited ? "Link copied" : "Guardian link"} icon={<Link2 size={22} strokeWidth={2.2} />} onClick={copyGuardianLink} />
        <RoundAction label="Skip ahead" icon={<FastForward size={21} strokeWidth={2.2} />} onClick={skipAhead} disabled={busy || done || s.phase === "releasable"} />
      </div>

      <ErrorNote message={actionError} />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Key shares</h2>
          <span className="text-[13px] font-semibold text-muted-foreground">any 2 of 3 sign</span>
        </div>
        <ShareStack>
          <ShareCard first tone="yellow" kicker="Share 1 · owner" title="You" right={<Ready />} />
          <ShareCard tone="indigo" kicker="Share 2 · guardian" title={vault.guardian} right={<Ready />} />
          <ShareCard tone="paper" kicker="Share 3 · automatic" title={switchTitle(vault)} right={<SwitchState vault={vault} />}>
            <SwitchBody vault={vault} now={now} />
          </ShareCard>
        </ShareStack>
      </section>

      {grace && s.phase === "grace" && (
        <Button onClick={() => act(() => api.checkIn(vault.id))} disabled={busy}>
          I&apos;m here, cancel the release
        </Button>
      )}
      {s.phase === "releasable" && <ButtonLink href={`/guardian/${vault.id}`}>Guardian: review the release</ButtonLink>}
      {done && (
        <ButtonLink href={`/guardian/${vault.id}`} variant="dark">
          See how it was signed
        </ButtonLink>
      )}

      <Link href={`/heir/${vault.id}`} className="block">
        <Tile className="flex items-center gap-3.5 px-4 py-3.5 transition active:scale-[0.99]">
          <Avatar name={vault.heir.name} tone="paper" size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-muted-foreground">Heir</p>
            <p className="text-[16px] font-bold">{vault.heir.name}</p>
          </div>
          <span className="max-w-[40%] truncate font-mono text-[12px] text-muted-foreground">{short(vault.heir.address, 8, 4)}</span>
          <ChevronRight size={18} className="text-subtle" aria-hidden />
        </Tile>
      </Link>

      {vault.vaultAddress && (
        <Tile className="flex items-center gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-muted-foreground">Vault address</p>
            <p className="truncate font-mono text-[12.5px]">{short(vault.vaultAddress, 16, 8)}</p>
          </div>
          <Button variant="dark" size="sm" className="w-auto" onClick={copyAddress}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </Tile>
      )}

      <BottomBar id={vault.id} />
    </Screen>
  );
}

function switchTitle(v: VaultView) {
  const p = v.status.phase;
  if (p === "released") return `Sent to ${v.heir.name}`;
  if (p === "signing") return "Signing the release";
  if (p === "releasable") return "Release unlocked";
  if (p === "grace") return "Grace period";
  return "Check-in switch";
}

function SwitchState({ vault }: { vault: VaultView }) {
  const p = vault.status.phase;
  const map = {
    armed: ["Armed", "text-[#13824a]"],
    paused: ["Paused", "opacity-60"],
    grace: ["Waiting", "text-[#c2410c]"],
    releasable: ["Unlocked", "text-[#c2410c]"],
    signing: ["Signing", "text-[#c2410c]"],
    released: ["Done", "text-[#13824a]"],
  } as const;
  const [text, cls] = map[p];
  return <span className={cn("text-[14px] font-extrabold", cls)}>{text}</span>;
}

function SwitchBody({ vault, now }: { vault: VaultView; now: number }) {
  const s = vault.status;
  if (s.phase === "released" || s.phase === "signing") {
    return (
      <p className="mt-3 text-[14.5px] leading-snug font-medium opacity-70">
        {vault.guardian} and the switch signed together. The note reached {vault.heir.name} in the encrypted memo.
      </p>
    );
  }
  const grace = s.phase === "grace" || s.phase === "releasable";
  const target = grace ? Date.parse(s.graceEndsAt) : Date.parse(s.nextCheckinAt);
  const left = Math.max(0, target - now);
  return (
    <>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[12.5px] font-bold opacity-55">{s.phase === "releasable" ? "Grace period" : grace ? "Release unlocks in" : "Next check-in in"}</p>
          <p className="text-[34px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">{s.phase === "releasable" ? "Over" : clock(left)}</p>
        </div>
        <p className="pb-1 text-[13px] font-bold opacity-55">
          missed {s.missed} of {vault.schedule.missLimit}
        </p>
      </div>
      <Segments className="mt-3.5" total={vault.schedule.missLimit} done={s.missed} tone="ink" />
    </>
  );
}

function Ready() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold opacity-75">
      <span className="size-1.5 rounded-full bg-current" /> Ready
    </span>
  );
}

function PhasePill({ phase }: { phase: VaultView["status"]["phase"] }) {
  const map = {
    armed: ["Armed", "alive"],
    paused: ["Paused", "dark"],
    grace: ["Grace", "wait"],
    releasable: ["Releasable", "wait"],
    signing: ["Signing", "wait"],
    released: ["Released", "yellow"],
  } as const;
  const [text, tone] = map[phase];
  return <Pill tone={tone}>{text}</Pill>;
}
