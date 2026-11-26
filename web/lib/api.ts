export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export type Phase = "armed" | "grace" | "releasable" | "signing" | "released" | "paused";

export interface ReleaseStep {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
  detail?: string;
  at?: string;
}

export interface VaultView {
  id: string;
  owner: string;
  guardian: string;
  heir: { name: string; address: string };
  memo: string;
  schedule: { checkinPeriodSec: number; missLimit: number; graceSec: number };
  lastCheckinAt: string;
  status: { phase: Phase; missed: number; nextCheckinAt: string; graceEndsAt: string; msLeft: number };
  vaultAddress?: string;
  groupPubKey?: string;
  balance: { totalZat: number; orchardSpendableZat: number; ironwoodSpendableZat: number; height: number } | null;
  release: { approvedAt: string; amountZat?: number; steps: ReleaseStep[]; txid?: string; error?: string } | null;
}

export interface CreateVaultInput {
  ownerName: string;
  guardianName: string;
  heirName: string;
  heirAddress: string;
  memo: string;
  schedule: "demo" | "weekly" | "monthly" | "quarterly";
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  vaults: () => call<VaultView[]>("/vaults"),
  health: () => call<{ ok: boolean; frostd: string | null }>("/health"),
  vault: (id: string, balance = true) => call<VaultView>(`/vaults/${id}${balance ? "" : "?balance=0"}`),
  create: (input: CreateVaultInput) => call<VaultView>("/vaults", { method: "POST", body: JSON.stringify(input) }),
  checkIn: (id: string) => call<VaultView>(`/vaults/${id}/checkin`, { method: "POST" }),
  approve: (id: string) => call<VaultView>(`/vaults/${id}/approve`, { method: "POST" }),
  resetRelease: (id: string) => call<VaultView>(`/vaults/${id}/release/reset`, { method: "POST" }),
  fastForward: (id: string, periods: number) =>
    call<VaultView>(`/vaults/${id}/demo/fast-forward`, { method: "POST", body: JSON.stringify({ periods }) }),
};
