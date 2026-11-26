import { describe, expect, test } from "bun:test";
import { vaultStatus } from "./schedule";
import type { Vault } from "./types";

const T0 = Date.parse("2026-11-26T00:00:00Z");
const vault = (over: Partial<Vault> = {}): Vault => ({
  id: "v1",
  createdAt: new Date(T0).toISOString(),
  owner: { name: "Ravi" },
  guardian: { name: "Anjali" },
  heir: { name: "Maya", address: "utest1example" },
  memo: "",
  schedule: { checkinPeriodSec: 60, missLimit: 3, graceSec: 120 },
  lastCheckinAt: new Date(T0).toISOString(),
  paused: false,
  ...over,
});

describe("vaultStatus", () => {
  test("armed right after a check-in", () => {
    const s = vaultStatus(vault(), T0 + 1_000);
    expect(s.phase).toBe("armed");
    expect(s.missed).toBe(0);
    expect(s.msLeft).toBe(59_000);
  });

  test("counts missed check-ins while still armed", () => {
    const s = vaultStatus(vault(), T0 + 125_000);
    expect(s.phase).toBe("armed");
    expect(s.missed).toBe(2);
  });

  test("enters grace exactly at the miss limit", () => {
    const s = vaultStatus(vault(), T0 + 180_000);
    expect(s.phase).toBe("grace");
    expect(s.missed).toBe(3);
    expect(s.msLeft).toBe(120_000);
  });

  test("releasable once grace ends", () => {
    expect(vaultStatus(vault(), T0 + 300_000).phase).toBe("releasable");
  });

  test("a check-in during grace re-arms the switch", () => {
    const s = vaultStatus(vault({ lastCheckinAt: new Date(T0 + 200_000).toISOString() }), T0 + 201_000);
    expect(s.phase).toBe("armed");
  });

  test("paused, signing and released override the clock", () => {
    expect(vaultStatus(vault({ paused: true }), T0 + 999_000).phase).toBe("paused");
    const release = { approvedAt: "", steps: [] };
    expect(vaultStatus(vault({ release }), T0 + 999_000).phase).toBe("signing");
    expect(vaultStatus(vault({ release: { ...release, txid: "ab" } }), T0).phase).toBe("released");
  });
});
