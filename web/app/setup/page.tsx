"use client";

import { ArrowRight, Check, ChevronLeft, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, ErrorNote, IconButton, Label, Rows, Screen, Tile, cn } from "@/components/ui";
import { api, type CreateVaultInput } from "@/lib/api";

const SCHEDULES: Array<{ value: CreateVaultInput["schedule"]; label: string }> = [
  { value: "demo", label: "30 sec" },
  { value: "weekly", label: "7 days" },
  { value: "monthly", label: "30 days" },
  { value: "quarterly", label: "90 days" },
];

const input = "w-full bg-transparent text-[16px] font-semibold text-foreground outline-none placeholder:text-subtle";

export default function Setup() {
  const router = useRouter();
  const [form, setForm] = useState<CreateVaultInput>({
    ownerName: "Ravi",
    guardianName: "Anjali",
    heirName: "Maya",
    heirAddress: "",
    memo: "The house papers are with Anjali. Love, Dad.",
    schedule: "demo",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof CreateVaultInput) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const addressOk = /^utest1[0-9a-z]{40,}$/.test(form.heirAddress);
  const memoBytes = new TextEncoder().encode(form.memo).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const v = await api.create(form);
      router.push(`/vault/${v.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <header className="flex items-center gap-3">
        <IconButton href="/" label="Back">
          <ChevronLeft size={22} aria-hidden />
        </IconButton>
        <p className="text-[19px] font-extrabold tracking-[-0.02em]">New vault</p>
      </header>

      <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.035em]">
        One key, split three ways. <span className="text-primary">Any two sign.</span>
      </h1>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-5">
        <Rows>
          <Field id="owner" label="You" dot="bg-primary">
            <input id="owner" className={input} value={form.ownerName} onChange={set("ownerName")} required maxLength={40} />
          </Field>
          <Field id="guardian" label="Guardian" dot="bg-indigo">
            <input id="guardian" className={input} value={form.guardianName} onChange={set("guardianName")} required maxLength={40} />
          </Field>
          <Field id="heir" label="Heir" dot="bg-paper">
            <input id="heir" className={input} value={form.heirName} onChange={set("heirName")} required maxLength={40} />
          </Field>
        </Rows>

        <section className="flex flex-col gap-2.5">
          <Label>{form.heirName || "Heir"}&apos;s Zcash address</Label>
          <Tile className="px-5 py-4">
            <input
              aria-label="Heir's Zcash address"
              className={cn(input, "font-mono text-[14px] font-medium")}
              placeholder="utest1…"
              value={form.heirAddress}
              onChange={set("heirAddress")}
              required
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
          </Tile>
          {form.heirAddress && (
            <p className={cn("flex items-center gap-1.5 text-[13.5px] font-semibold", addressOk ? "text-alive" : "text-wait")}>
              {addressOk && <Check size={15} strokeWidth={3} aria-hidden />}
              {addressOk ? "Testnet unified address" : "Needs a testnet unified address (utest1…)"}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2.5">
          <Label>Check in every</Label>
          <div className="grid grid-cols-4 gap-1.5 rounded-full bg-surface p-1.5" role="radiogroup" aria-label="Check-in period">
            {SCHEDULES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={form.schedule === s.value}
                onClick={() => setForm({ ...form, schedule: s.value })}
                className={cn(
                  "h-11 rounded-full text-[14px] font-bold transition",
                  form.schedule === s.value ? "bg-primary text-primary-ink" : "text-muted-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-[13.5px] leading-snug text-muted-foreground">
            Miss 3 in a row and a grace period starts. After that, {form.guardianName || "your guardian"} can release the vault.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <Label>Note to {form.heirName || "your heir"}</Label>
            <span className={cn("font-mono text-[11.5px]", memoBytes > 512 ? "text-block" : "text-subtle")}>{memoBytes}/512</span>
          </div>
          <Tile className="px-5 py-4">
            <textarea aria-label="Private note" rows={2} className={cn(input, "resize-none leading-snug font-medium")} value={form.memo} onChange={set("memo")} />
          </Tile>
        </section>

        <ErrorNote message={error} />

        <Button type="submit" disabled={busy || !addressOk || memoBytes > 512} className="mt-auto">
          {busy ? (
            <>
              <LoaderCircle size={18} className="animate-spin" aria-hidden /> Splitting the key…
            </>
          ) : (
            <>
              Create vault <ArrowRight size={18} strokeWidth={2.6} aria-hidden />
            </>
          )}
        </Button>
      </form>
    </Screen>
  );
}

function Field({ id, label, dot, children }: { id: string; label: string; dot: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-4">
      <span className={cn("size-2.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
      <label htmlFor={id} className="w-[76px] shrink-0 text-[15px] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
