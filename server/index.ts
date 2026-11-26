import { Hono } from "hono";
import { cors } from "hono/cors";
import { startBot } from "./src/bot";
import { vaultStatus } from "./src/schedule";
import { getVault, listVaults } from "./src/store";
import type { Vault } from "./src/types";
import {
  approveRelease,
  checkIn,
  createVault,
  fastForward,
  resetRelease,
  vaultBalance,
  type CreateVaultInput,
} from "./src/vaults";

const app = new Hono();
app.use("/api/*", cors({ origin: (o) => o ?? "*" }));

/** Public shape: never expose FROST config paths or the UFVK. */
async function view(v: Vault, withBalance = true) {
  const balance = withBalance ? await vaultBalance(v).catch(() => null) : null;
  return {
    id: v.id,
    owner: v.owner.name,
    guardian: v.guardian.name,
    heir: { name: v.heir.name, address: v.heir.address },
    memo: v.memo,
    schedule: v.schedule,
    lastCheckinAt: v.lastCheckinAt,
    status: vaultStatus(v),
    vaultAddress: v.wallet?.address,
    groupPubKey: v.frost?.groupPubKey,
    balance,
    release: v.release ?? null,
  };
}

const must = async (id: string) => {
  const v = await getVault(id);
  if (!v) throw Object.assign(new Error("vault not found"), { status: 404 });
  return v;
};

app.get("/api/health", (c) => c.json({ ok: true, frostd: process.env.FROSTD_URL ?? null }));
app.get("/api/vaults", async (c) => c.json(await Promise.all((await listVaults()).map((v) => view(v, false)))));
app.get("/api/vaults/:id", async (c) => c.json(await view(await must(c.req.param("id")), c.req.query("balance") !== "0")));
app.post("/api/vaults", async (c) => c.json(await view(await createVault(await c.req.json<CreateVaultInput>()), false), 201));
app.post("/api/vaults/:id/checkin", async (c) => c.json(await view(await checkIn(c.req.param("id")), false)));
app.post("/api/vaults/:id/approve", async (c) => {
  await approveRelease(c.req.param("id"));
  return c.json(await view(await must(c.req.param("id")), false), 202);
});
app.post("/api/vaults/:id/release/reset", async (c) => c.json(await view(await resetRelease(c.req.param("id")), false)));
app.post("/api/vaults/:id/demo/fast-forward", async (c) => {
  const { periods = 3 } = await c.req.json<{ periods?: number }>().catch(() => ({ periods: 3 }));
  return c.json(await view(await fastForward(c.req.param("id"), Math.min(10, Math.max(0, periods))), false));
});

app.onError((err, c) => {
  const status = (err as { status?: number }).status ?? 500;
  if (status >= 500) console.error(err);
  return c.json({ error: err.message }, status as 400);
});

const port = Number(process.env.PORT ?? 8787);
startBot().catch((err) => console.error("telegram bot disabled:", err.message));
console.log(`ZecHeir switch service on http://localhost:${port} (frostd: ${process.env.FROSTD_URL ?? "unset"})`);

export default { port, fetch: app.fetch };
