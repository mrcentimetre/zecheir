export type VaultPhase = "armed" | "grace" | "releasable" | "signing" | "released" | "paused";

export interface Person {
  name: string;
  telegramChatId?: number;
}

export interface Heir extends Person {
  /** Unified address with an Orchard receiver (testnet: starts with `utest1`). */
  address: string;
}

export interface VaultSchedule {
  /** How often the owner must check in, in seconds. */
  checkinPeriodSec: number;
  /** Consecutive missed check-ins before the grace period starts. */
  missLimit: number;
  /** Grace period length in seconds, after the miss limit is reached. */
  graceSec: number;
}

export interface FrostGroup {
  /** FROST group public key (hex) == Orchard spend validating key `ak`. */
  groupPubKey: string;
  /** frost-client contact public keys (hex) for each share holder. */
  participants: { owner: string; guardian: string; switch: string };
}

export interface ReleaseStep {
  key: "create" | "sighash" | "round1" | "round2" | "aggregate" | "prove" | "combine" | "broadcast";
  label: string;
  status: "pending" | "running" | "done" | "failed";
  detail?: string;
  at?: string;
}

export interface Vault {
  id: string;
  createdAt: string;
  owner: Person;
  guardian: Person;
  heir: Heir;
  /** Private note to the heir, carried in the encrypted Zcash memo (max 512 bytes). */
  memo: string;
  schedule: VaultSchedule;
  lastCheckinAt: string;
  paused: boolean;
  frost?: FrostGroup;
  wallet?: {
    /** Orchard-only vault address derived from the FROST group key. */
    address: string;
    /** Unified full viewing key — lets the switch see balance, never spend. */
    ufvk: string;
    birthday: number;
  };
  release?: {
    approvedAt: string;
    /** What the heir receives: vault balance at approval, then the exact PCZT output (after fee). */
    amountZat?: number;
    steps: ReleaseStep[];
    txid?: string;
    error?: string;
  };
}

export interface VaultStatus {
  phase: VaultPhase;
  missed: number;
  nextCheckinAt: string;
  graceEndsAt: string;
  /** Milliseconds until the next relevant deadline (check-in or grace end). */
  msLeft: number;
}
