import { RECORDED_DEMO } from "./snapshot";

// The hosted switch service; set NEXT_PUBLIC_ZECHEIR_API (e.g. http://localhost:8787) to use your own.
export const API_URL = process.env.NEXT_PUBLIC_ZECHEIR_API || "https://zecheir-api.nimsara.me";

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
  /** True when this is the recorded copy shown while the live server is offline. */
  recorded?: boolean;
}

export interface CreateVaultInput {
  ownerName: string;
  guardianName: string;
  heirName: string;
  heirAddress: string;
  memo: string;
  schedule: "demo" | "weekly" | "monthly" | "quarterly";
}

export const OFFLINE_MESSAGE =
  "The live signing server is offline right now, so this is a recorded copy of the real testnet release. Actions are disabled.";

/** When the switch service can't be reached, reads fall back to the recorded demo. */
function recorded(path: string): unknown {
  if (path.startsWith("/vaults/demo")) return { ...RECORDED_DEMO, recorded: true };
  if (path === "/vaults") return [{ ...RECORDED_DEMO, recorded: true }];
  if (path === "/health") return { ok: false, frostd: null };
  throw new Error(`${OFFLINE_MESSAGE} Open the demo vault to see it.`);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(init?.method === "POST" ? 180_000 : 12_000),
    });
  } catch {
    if (!init?.method || init.method === "GET") return recorded(path) as T;
    throw new Error(OFFLINE_MESSAGE);
  }
  // 502/503/504/530: the tunnel is up at Cloudflare but the Mac behind it is not.
  const gatewayDown = [502, 503, 504, 530].includes(res.status);
  if (gatewayDown && (!init?.method || init.method === "GET")) return recorded(path) as T;
  if (gatewayDown) throw new Error(OFFLINE_MESSAGE);
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
