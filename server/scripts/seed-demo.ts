// Register the hand-built vault in data/demo as vault id "demo".
// Usage: bun scripts/seed-demo.ts <heir-utest1-address>
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { groupInfo } from "../src/frost";
import { saveVault } from "../src/store";
import { SCHEDULES } from "../src/vaults";

const dir = join(import.meta.dir, "..", "..", "data", "demo");
const heirAddress = process.argv[2];
if (!heirAddress?.startsWith("utest1")) throw new Error("usage: bun scripts/seed-demo.ts <utest1… heir address>");

const keys = await readFile(join(dir, "vault-keys.txt"), "utf8");
const address = keys.match(/address: "([^"]+)"/)?.[1];
const ufvk = keys.match(/Viewing Key: "([^"]+)"/)?.[1];
if (!address || !ufvk) throw new Error("vault-keys.txt is missing the address or UFVK");

const g = await groupInfo(join(dir, "switch.toml"));
const pk = (name: string) => g.participants.find((p) => p.name === name)!.pubkey;

const v = await saveVault({
  id: "demo",
  createdAt: new Date().toISOString(),
  owner: { name: "Ravi" },
  guardian: { name: "Anjali" },
  heir: { name: "Maya", address: heirAddress },
  memo: "The house papers are with Anjali. Love, Dad.",
  schedule: SCHEDULES.demo,
  lastCheckinAt: new Date().toISOString(),
  paused: false,
  frost: { groupPubKey: g.groupPubKey, participants: { owner: pk("Owner"), guardian: pk("Guardian"), switch: g.participants.find((p) => p.self)!.pubkey } },
  wallet: { address, ufvk, birthday: 4_666_500 },
});
console.log(`seeded vault "${v.id}" → ${address.slice(0, 16)}…`);
