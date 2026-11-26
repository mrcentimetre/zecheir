"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type VaultView } from "./api";

/**
 * Poll a vault. Balance (which triggers a wallet sync on the server) is refreshed less often
 * than the status, so the countdown stays live without hammering lightwalletd.
 */
export function useVault(id: string, { intervalMs = 3000, balanceEveryMs = 30_000 } = {}) {
  const [vault, setVault] = useState<VaultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastBalance = useRef(0);

  const refresh = useCallback(
    async (withBalance = false) => {
      try {
        const v = await api.vault(id, withBalance);
        setVault((prev) => (v.balance || !prev ? v : { ...v, balance: prev.balance }));
        if (withBalance) lastBalance.current = Date.now();
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id]
  );

  useEffect(() => {
    refresh(true);
    const poll = setInterval(() => refresh(Date.now() - lastBalance.current > balanceEveryMs), intervalMs);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh, intervalMs, balanceEveryMs]);

  return { vault, setVault, error, refresh, now };
}
