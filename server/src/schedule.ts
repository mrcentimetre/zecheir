import type { Vault, VaultStatus } from "./types";

/**
 * The dead man's switch, as a pure function of time.
 *
 *   lastCheckin ──period──▶ due #1 ──period──▶ due #2 ──period──▶ due #3 (= missLimit)
 *                                                                   └──grace──▶ releasable
 */
export function vaultStatus(vault: Vault, now = Date.now()): VaultStatus {
  const { checkinPeriodSec, missLimit, graceSec } = vault.schedule;
  const last = Date.parse(vault.lastCheckinAt);
  const periodMs = checkinPeriodSec * 1000;
  const missDeadline = last + periodMs * missLimit;
  const graceEnd = missDeadline + graceSec * 1000;

  const elapsed = Math.max(0, now - last);
  const missed = Math.min(missLimit, Math.floor(elapsed / periodMs));
  const nextCheckinAt = new Date(last + periodMs * (missed + 1));

  const base = {
    missed,
    nextCheckinAt: nextCheckinAt.toISOString(),
    graceEndsAt: new Date(graceEnd).toISOString(),
  };

  if (vault.release?.txid) return { ...base, phase: "released", msLeft: 0 };
  if (vault.release) return { ...base, phase: "signing", msLeft: 0 };
  if (vault.paused) return { ...base, phase: "paused", msLeft: 0 };
  if (now < missDeadline) {
    return { ...base, phase: "armed", msLeft: nextCheckinAt.getTime() - now };
  }
  if (now < graceEnd) return { ...base, phase: "grace", msLeft: graceEnd - now };
  return { ...base, phase: "releasable", msLeft: 0 };
}
