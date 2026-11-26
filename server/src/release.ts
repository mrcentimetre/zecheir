import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { frostSign } from "./frost";
import type { ReleaseStep } from "./types";
import {
  combinePczts,
  createReleasePczt,
  pcztOutputTo,
  provePczt,
  sendPczt,
  startSighashSession,
  syncWallet,
} from "./wallet";

export interface ReleaseInput {
  walletDir: string;
  workDir: string;
  heirAddress: string;
  memo: string;
  frost: {
    serverUrl: string;
    groupPubKey: string;
    switchConfig: string;
    guardianConfig: string;
    switchPubkey: string;
    guardianPubkey: string;
  };
  onStep?: (steps: ReleaseStep[]) => void | Promise<void>;
  /** Called with the exact amount (zatoshis) the heir will receive, once the PCZT is built. */
  onAmount?: (zat: number) => void | Promise<void>;
}

export const RELEASE_STEPS: Array<Pick<ReleaseStep, "key" | "label">> = [
  { key: "create", label: "Build the payment to the heir" },
  { key: "sighash", label: "Compute what must be signed" },
  { key: "round1", label: "Round 1 · commitments" },
  { key: "round2", label: "Round 2 · signature shares" },
  { key: "aggregate", label: "Signature combined" },
  { key: "prove", label: "Zero-knowledge proofs" },
  { key: "combine", label: "Assemble the transaction" },
  { key: "broadcast", label: "Broadcast to Zcash testnet" },
];

/**
 * The release: guardian + switch (2 of 3) sign the ONE payment the owner pre-agreed.
 * The switch builds the transaction itself and only signs a message equal to its sighash,
 * so it can never be tricked into signing anything else.
 */
export async function runRelease(input: ReleaseInput): Promise<string> {
  const steps: ReleaseStep[] = RELEASE_STEPS.map((s) => ({ ...s, status: "pending" }));
  const mark = async (key: ReleaseStep["key"], status: ReleaseStep["status"], detail?: string) => {
    const step = steps.find((s) => s.key === key)!;
    Object.assign(step, { status, detail: detail ?? step.detail, at: new Date().toISOString() });
    await input.onStep?.(steps.map((s) => ({ ...s })));
  };
  let current: ReleaseStep["key"] = "create";
  const step = async <T>(key: ReleaseStep["key"], fn: () => Promise<T>, detail?: (r: T) => string): Promise<T> => {
    current = key;
    await mark(key, "running");
    const r = await fn();
    await mark(key, "done", detail?.(r));
    return r;
  };

  await mkdir(input.workDir, { recursive: true });
  const created = join(input.workDir, "release.created.pczt");
  const signed = join(input.workDir, "release.signed.pczt");
  const proven = join(input.workDir, "release.proven.pczt");
  const combined = join(input.workDir, "release.combined.pczt");

  try {
    await step("create", async () => {
      await syncWallet(input.walletDir);
      await createReleasePczt(input.walletDir, input.heirAddress, input.memo, created);
      const zat = await pcztOutputTo(created, input.heirAddress).catch(() => null);
      if (zat != null) await input.onAmount?.(zat);
    }, () => "all funds → heir, memo attached");

    const session = await step("sighash", () => startSighashSession(created, signed), (s) =>
      `sighash ${s.sighash.slice(0, 8)}…${s.sighash.slice(-4)} · ${s.randomizers.length} spend(s)`);

    const onlyThePreAgreedPayment = (m: string) => m === session.sighash;
    current = "round1";
    await mark("round1", "running");
    const signatures = await frostSign({
      serverUrl: input.frost.serverUrl,
      groupPubKey: input.frost.groupPubKey,
      coordinatorConfig: input.frost.switchConfig,
      signerPubkeys: [input.frost.guardianPubkey, input.frost.switchPubkey],
      signers: [
        { config: input.frost.guardianConfig, approve: onlyThePreAgreedPayment },
        { config: input.frost.switchConfig, approve: onlyThePreAgreedPayment },
      ],
      sighash: session.sighash,
      randomizers: session.randomizers,
      workDir: join(input.workDir, "frost"),
      onProgress: async (e, d) => {
        if (e === "round2") await mark("round1", "done", "guardian + switch joined");
        current = e;
        await mark(e, e === "aggregate" ? "done" : "running", d);
        if (e === "aggregate") await mark("round2", "done");
      },
    });
    await session.submit(signatures);

    await step("prove", () => provePczt(input.walletDir, created, proven), () => "Halo 2 proofs created");
    await step("combine", () => combinePczts([signed, proven], combined), () => "signatures + proofs merged");
    return await step("broadcast", () => sendPczt(input.walletDir, combined), (txid) => `txid ${txid}`);
  } catch (err) {
    await mark(current, "failed", String((err as Error).message ?? err).slice(0, 300));
    throw err;
  }
}
