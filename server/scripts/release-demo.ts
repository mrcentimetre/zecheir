// End-to-end: release the demo vault to an heir address with a FROST 2-of-3 signature.
// Usage: bun scripts/release-demo.ts <heir-utest1-address> [memo]
import { join } from "node:path";
import { groupInfo } from "../src/frost";
import { runRelease } from "../src/release";
import { getBalance, syncWallet } from "../src/wallet";

const dir = join(import.meta.dir, "..", "..", "data", "demo");
const heir = process.argv[2];
if (!heir?.startsWith("utest1")) throw new Error("usage: bun scripts/release-demo.ts <utest1… heir address> [memo]");
const memo = process.argv[3] ?? "The house papers are with Anjali. Love, Dad.";

const walletDir = join(dir, "vault-wallet");
await syncWallet(walletDir);
console.log("vault balance:", await getBalance(walletDir));

const sw = await groupInfo(join(dir, "switch.toml"));
const t0 = Date.now();
const txid = await runRelease({
  walletDir,
  workDir: join(dir, "release"),
  heirAddress: heir,
  memo,
  frost: {
    serverUrl: sw.serverUrl!,
    groupPubKey: sw.groupPubKey,
    switchConfig: join(dir, "switch.toml"),
    guardianConfig: join(dir, "guardian.toml"),
    switchPubkey: sw.participants.find((p) => p.self)!.pubkey,
    guardianPubkey: sw.participants.find((p) => p.name === "Guardian")!.pubkey,
  },
  onStep: (steps) => {
    const s = steps.filter((x) => x.status !== "pending").at(-1)!;
    console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s.status.padEnd(7)} ${s.label}${s.detail ? ` — ${s.detail}` : ""}`);
  },
});
console.log("\nRELEASED. txid:", txid);
