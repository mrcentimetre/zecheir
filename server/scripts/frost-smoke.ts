// Smoke test: run a real FROST 2-of-3 signing session (guardian + switch) through frostd
// over the tunnel, on a dummy message. Usage: bun scripts/frost-smoke.ts <demo-dir>
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { frostSign, groupInfo } from "../src/frost";

const dir = process.argv[2] ?? "../data/demo";
const sw = await groupInfo(join(dir, "switch.toml"));
const guardianPk = sw.participants.find((p) => p.name === "Guardian")!.pubkey;
const switchPk = sw.participants.find((p) => p.self)!.pubkey;

const sighash = randomBytes(32).toString("hex");
const alpha = "01" + "00".repeat(31); // scalar 1 (little-endian), always a valid Pallas scalar
const t0 = Date.now();

const sigs = await frostSign({
  serverUrl: sw.serverUrl!,
  groupPubKey: sw.groupPubKey,
  coordinatorConfig: join(dir, "switch.toml"),
  signerPubkeys: [guardianPk, switchPk],
  signers: [
    { config: join(dir, "guardian.toml"), approve: (m) => m === sighash },
    { config: join(dir, "switch.toml"), approve: (m) => m === sighash },
  ],
  sighash,
  randomizers: [alpha],
  workDir: join(dir, "smoke"),
  onProgress: (e, d) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${e}: ${d ?? ""}`),
});
console.log("signature:", sigs[0], `(${sigs[0].length / 2} bytes)`);
