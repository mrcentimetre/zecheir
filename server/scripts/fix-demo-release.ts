// One-off: backfill the exact heir amount for releases made before amounts were read from the PCZT.
// Usage: bun scripts/fix-demo-release.ts <vaultId> <zatoshis>
import { updateVault } from "../src/store";

const [id, zat] = process.argv.slice(2);
if (!id || !zat) throw new Error("usage: bun scripts/fix-demo-release.ts <vaultId> <zatoshis>");
const v = await updateVault(id, (x) => {
  if (!x.release) throw new Error("vault has no release");
  x.release.amountZat = Number(zat);
  const create = x.release.steps.find((s) => s.key === "create");
  if (create) create.label = "Build the payment to the heir";
});
console.log(`vault ${v.id}: amountZat=${v.release?.amountZat}`);
