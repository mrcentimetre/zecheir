import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { groupInfo } from "./frost";
import { bin, run } from "./proc";
import { runRelease } from "./release";
import { vaultStatus } from "./schedule";
import { DATA_DIR, getVault, saveVault, updateVault } from "./store";
import type { Vault, VaultSchedule } from "./types";
import { getBalance, initViewWallet, syncWallet, type Balance } from "./wallet";

export const FROST_SERVER = () => {
  const url = process.env.FROSTD_URL;
  if (!url) throw new Error("FROSTD_URL is not set (e.g. my-tunnel.trycloudflare.com:443)");
  return url;
};

export const vaultDir = (id: string) => join(DATA_DIR, "vaults", id);
const cfg = (id: string, who: "owner" | "guardian" | "switch") => join(vaultDir(id), `${who}.toml`);

/** Demo schedules: real defaults are 30 days / 3 misses / 14 days grace. */
export const SCHEDULES: Record<string, VaultSchedule> = {
  demo: { checkinPeriodSec: 30, missLimit: 3, graceSec: 60 },
  weekly: { checkinPeriodSec: 7 * 86400, missLimit: 3, graceSec: 14 * 86400 },
  monthly: { checkinPeriodSec: 30 * 86400, missLimit: 3, graceSec: 14 * 86400 },
  quarterly: { checkinPeriodSec: 90 * 86400, missLimit: 3, graceSec: 14 * 86400 },
};

export interface CreateVaultInput {
  ownerName: string;
  guardianName: string;
  heirName: string;
  heirAddress: string;
  memo: string;
  schedule: keyof typeof SCHEDULES;
}

/**
 * Create a vault: split a fresh RedPallas key 2-of-3 between owner, guardian and the switch,
 * derive the Orchard vault address + UFVK ONCE (zcash-sign generate is randomized), and
 * create the switch's view-only wallet.
 */
export async function createVault(input: CreateVaultInput): Promise<Vault> {
  validateCreate(input);
  const id = crypto.randomUUID().slice(0, 8);
  const dir = vaultDir(id);
  await mkdir(dir, { recursive: true });
  const fc = bin("frost-client");

  for (const who of ["owner", "guardian", "switch"] as const) {
    await run(fc, ["init", "-c", cfg(id, who)]);
  }
  // lean-ctx: trusted dealer for the MVP; DKG (frost-client dkg) removes the dealer — upgrade when signers run their own devices
  await run(fc, [
    "trusted-dealer", "-d", `ZecHeir vault ${id}`, "--names", "Owner,Guardian,Switch",
    "-c", cfg(id, "owner"), "-c", cfg(id, "guardian"), "-c", cfg(id, "switch"),
    "-C", "redpallas", "-s", FROST_SERVER(),
  ]);
  const group = await groupInfo(cfg(id, "switch"));
  const pk = (name: string) => group.participants.find((p) => p.name === name)!.pubkey;

  const gen = await run(bin("zcash-sign"), ["generate", "--network", "test", "--ak", group.groupPubKey]);
  const address = gen.stdout.match(/address: "([^"]+)"/)?.[1];
  const ufvk = gen.stdout.match(/Viewing Key: "([^"]+)"/)?.[1];
  if (!address || !ufvk) throw new Error("zcash-sign generate returned no address/UFVK");

  const birthday = await chainTip().then((h) => h - 100).catch(() => FALLBACK_BIRTHDAY);
  await initViewWallet(join(dir, "wallet"), ufvk, birthday);

  const now = new Date().toISOString();
  return saveVault({
    id,
    createdAt: now,
    owner: { name: input.ownerName },
    guardian: { name: input.guardianName },
    heir: { name: input.heirName, address: input.heirAddress },
    memo: input.memo,
    schedule: SCHEDULES[input.schedule],
    lastCheckinAt: now,
    paused: false,
    frost: {
      groupPubKey: group.groupPubKey,
      participants: { owner: pk("Owner"), guardian: pk("Guardian"), switch: group.participants.find((p) => p.self)!.pubkey },
    },
    wallet: { address, ufvk, birthday },
  });
}

/** A recent testnet height; a vault can't have funds from before it was created. */
const FALLBACK_BIRTHDAY = 4_666_000;

/** Current testnet tip from lightwalletd, via any synced wallet's `get-info`. */
async function chainTip(): Promise<number> {
  const { stdout } = await run(bin("zcash-devtool"), ["wallet", "-w", join(DATA_DIR, "demo", "vault-wallet"), "get-info"], { timeoutMs: 30_000 });
  const h = Number(stdout.match(/"(?:chain_tip_height|chain_tip|height)"\s*:\s*(\d+)/)?.[1]);
  if (!Number.isFinite(h) || h < FALLBACK_BIRTHDAY) throw new Error(`unexpected chain tip: ${stdout.slice(0, 200)}`);
  return h;
}

function validateCreate(i: CreateVaultInput) {
  const errors: string[] = [];
  for (const k of ["ownerName", "guardianName", "heirName"] as const) {
    if (!i[k]?.trim() || i[k].length > 40) errors.push(`${k} is required (max 40 chars)`);
  }
  if (!/^utest1[0-9a-z]{40,}$/.test(i.heirAddress ?? "")) errors.push("heirAddress must be a testnet unified address (utest1…)");
  if (new TextEncoder().encode(i.memo ?? "").length > 512) errors.push("memo must fit the 512-byte Zcash memo field");
  if (!(i.schedule in SCHEDULES)) errors.push(`schedule must be one of ${Object.keys(SCHEDULES).join(", ")}`);
  if (errors.length) throw Object.assign(new Error(errors.join("; ")), { status: 400 });
}

/** Register an existing vault directory (e.g. the hand-built data/demo vault). */
export async function adoptVault(v: Vault): Promise<Vault> {
  return saveVault(v);
}

const balanceCache = new Map<string, { at: number; balance: Balance }>();

export async function vaultBalance(v: Vault, maxAgeMs = 60_000): Promise<Balance | null> {
  if (!v.wallet) return null;
  const hit = balanceCache.get(v.id);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.balance;
  const dir = walletDirOf(v);
  await syncWallet(dir);
  const balance = await getBalance(dir);
  balanceCache.set(v.id, { at: Date.now(), balance });
  return balance;
}

export const walletDirOf = (v: Vault) => (v.id === "demo" ? join(DATA_DIR, "demo", "vault-wallet") : join(vaultDir(v.id), "wallet"));
const configOf = (v: Vault, who: "guardian" | "switch") => (v.id === "demo" ? join(DATA_DIR, "demo", `${who}.toml`) : cfg(v.id, who));

export async function checkIn(id: string) {
  return updateVault(id, (v) => {
    if (v.release) throw Object.assign(new Error("release already started"), { status: 409 });
    v.lastCheckinAt = new Date().toISOString();
    v.paused = false;
  });
}

/** Guardian approval. Only allowed once the grace period is over. Runs the FROST release in the background. */
export async function approveRelease(id: string) {
  const v = await getVault(id);
  if (!v) throw Object.assign(new Error("not found"), { status: 404 });
  const status = vaultStatus(v);
  if (status.phase !== "releasable") {
    throw Object.assign(new Error(`release not allowed while vault is ${status.phase}`), { status: 409 });
  }
  if (!v.frost) throw new Error("vault has no FROST group");
  const balance = await vaultBalance(v, 0).catch(() => null);
  await updateVault(id, (x) => (x.release = { approvedAt: new Date().toISOString(), amountZat: balance?.totalZat, steps: [] }));

  const frost = v.frost;
  runRelease({
    walletDir: walletDirOf(v),
    workDir: join(vaultDir(v.id), "release"),
    heirAddress: v.heir.address,
    memo: v.memo,
    frost: {
      serverUrl: FROST_SERVER(),
      groupPubKey: frost.groupPubKey,
      switchConfig: configOf(v, "switch"),
      guardianConfig: configOf(v, "guardian"),
      switchPubkey: frost.participants.switch,
      guardianPubkey: frost.participants.guardian,
    },
    onStep: (steps) => updateVault(id, (x) => x.release && (x.release.steps = steps)).then(() => undefined),
    onAmount: (zat) => updateVault(id, (x) => x.release && (x.release.amountZat = zat)).then(() => undefined),
  })
    .then((txid) => updateVault(id, (x) => x.release && (x.release.txid = txid)))
    .catch((err) => updateVault(id, (x) => x.release && (x.release.error = String(err.message ?? err))));
}

/** Demo helper: pretend the owner went silent `missedPeriods` check-in periods ago. */
export async function fastForward(id: string, missedPeriods: number) {
  return updateVault(id, (v) => {
    const ms = v.schedule.checkinPeriodSec * 1000 * missedPeriods;
    v.lastCheckinAt = new Date(Date.now() - ms).toISOString();
  });
}

/** Retry a failed release (e.g. tunnel hiccup): clears the failed attempt. */
export async function resetRelease(id: string) {
  return updateVault(id, (v) => {
    if (v.release?.txid) throw Object.assign(new Error("already released"), { status: 409 });
    delete v.release;
  });
}
