import { join } from "node:path";
import { bin, Interactive, run } from "./proc";

/** Lightwalletd server alias understood by zcash-devtool (testnet.zec.rocks for testnet keys). */
const SERVER = process.env.ZECHEIR_LWD_SERVER ?? "zecrocks";
const devtool = bin("zcash-devtool");

export interface Balance {
  totalZat: number;
  orchardSpendableZat: number;
  ironwoodSpendableZat: number;
  height: number;
}

const taz = (s?: string) => Math.round(Number(s ?? 0) * 1e8);

/** Create a view-only wallet for the vault from its UFVK. The switch can see funds, never spend. */
export async function initViewWallet(walletDir: string, ufvk: string, birthday: number) {
  await run(devtool, ["wallet", "-w", walletDir, "init-fvk", "--name", "ZecHeirVault", "--fvk", ufvk, "--birthday", String(birthday), "-s", SERVER], {
    timeoutMs: 180_000,
  });
}

export async function syncWallet(walletDir: string) {
  await run(devtool, ["wallet", "-w", walletDir, "sync", "-s", SERVER], { timeoutMs: 600_000 });
}

export async function getBalance(walletDir: string): Promise<Balance> {
  const { stdout } = await run(devtool, ["wallet", "-w", walletDir, "balance"]);
  return {
    totalZat: taz(stdout.match(/Balance:\s+([\d.]+) TAZ/)?.[1]),
    orchardSpendableZat: taz(stdout.match(/Orchard Spendable:\s+([\d.]+)/)?.[1]),
    ironwoodSpendableZat: taz(stdout.match(/Ironwood Spendable:\s+([\d.]+)/)?.[1]),
    height: Number(stdout.match(/Height:\s+(\d+)/)?.[1] ?? 0),
  };
}

/** Build the one pre-agreed transaction: everything in the vault to the heir, with the private memo. */
export async function createReleasePczt(walletDir: string, heirAddress: string, memo: string, out: string) {
  const args = ["pczt", "-w", walletDir, "create-max", "--address", heirAddress, "--output", out];
  if (memo) args.push("--memo", memo);
  await run(devtool, args, { timeoutMs: 180_000 });
}

/** Exact value (zatoshis) a PCZT pays to `address` — i.e. what the heir receives after the fee. */
export async function pcztOutputTo(pczt: string, address: string): Promise<number | null> {
  const { stdout } = await run(devtool, ["pczt", "inspect", pczt]);
  const re = new RegExp(`Output: (\\d+) zatoshis to ${address}`);
  const m = stdout.match(re);
  return m ? Number(m[1]) : null;
}

/** Create the Halo 2 proofs (no spend authority needed — proving is done by the view-only wallet). */
export async function provePczt(walletDir: string, input: string, out: string) {
  await run(devtool, ["pczt", "-w", walletDir, "prove", input, "--output", out], { timeoutMs: 600_000 });
}

export async function combinePczts(inputs: string[], out: string) {
  await run(devtool, ["pczt", "combine", ...inputs.flatMap((i) => ["-i", i]), "-o", out]);
}

/** Extract the final transaction and broadcast it. Returns the txid. */
export async function sendPczt(walletDir: string, input: string): Promise<string> {
  const res = await run(devtool, ["pczt", "-w", walletDir, "send", "-s", SERVER, input], { timeoutMs: 180_000 });
  const all = res.stdout + res.stderr;
  const txid = all.match(/\b([0-9a-f]{64})\b/)?.[1];
  if (!txid) throw new Error(`broadcast returned no txid: ${all.slice(-400)}`);
  return txid;
}

export interface SighashSession {
  sighash: string;
  randomizers: string[];
  /** Feed the FROST signatures (hex, one per randomizer); resolves when the signed PCZT is written. */
  submit: (signatures: string[]) => Promise<void>;
}

/**
 * Start `zcash-devtool pczt frost-sign` (our port of frost-tools' `zcash-sign sign`, built on the
 * same librustzcash revision as the wallet so it understands NU7/Ironwood v6 transactions).
 * It prints the SIGHASH and one randomizer per spend, then waits for the FROST signatures on stdin.
 */
export async function startSighashSession(pczt: string, signedOut: string): Promise<SighashSession> {
  const p = new Interactive(devtool, ["pczt", "frost-sign", "--input", pczt, "--output", signedOut]);
  const sighash = (await p.waitFor(/SIGHASH: ([0-9a-f]{64})/))[1];
  // Every randomizer line is printed before the first "Input … signature" prompt.
  await p.waitFor(/Input hex-encoded signature #\d+/);
  const randomizers = [...p.output.matchAll(/Randomizer #\d+ \([^)]*\): ([0-9a-f]{64})/g)].map((m) => m[1]);
  if (randomizers.length === 0) throw new Error("PCZT has no spends to sign");
  return {
    sighash,
    randomizers,
    submit: async (signatures) => {
      for (const sig of signatures) p.write(sig);
      await p.done;
    },
  };
}

export const releaseDir = (dataDir: string, vaultId: string) => join(dataDir, "vaults", vaultId, "release");
