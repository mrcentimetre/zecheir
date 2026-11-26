import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bin, Interactive, run } from "./proc";

export interface GroupInfo {
  description: string;
  groupPubKey: string;
  serverUrl?: string;
  threshold: number;
  /** Participants as listed in this config. `self` marks the config owner (shown with an empty name). */
  participants: Array<{ name: string; pubkey: string; self: boolean }>;
}

/** Parse `frost-client groups -c <config>`. Assumes one group per config (one vault per share file). */
export async function groupInfo(config: string): Promise<GroupInfo> {
  // frost-client prints the group listing to stderr
  const res = await run(bin("frost-client"), ["groups", "-c", config]);
  const stdout = res.stdout + res.stderr;
  const desc = stdout.match(/Group "([^"]*)"/)?.[1] ?? "";
  const groupPubKey = stdout.match(/Public key ([0-9a-f]{64})/)?.[1];
  if (!groupPubKey) throw new Error(`no FROST group found in ${config}`);
  const participants = [...stdout.matchAll(/^\t([^\t(]*)\t?\(([0-9a-f]{64})\)/gm)].map((m) => ({
    name: m[1].trim(),
    pubkey: m[2],
    self: m[1].trim() === "",
  }));
  return {
    description: desc,
    groupPubKey,
    serverUrl: stdout.match(/Server URL: (\S+)/)?.[1],
    threshold: Number(stdout.match(/Threshold: (\d+)/)?.[1] ?? 2),
    participants,
  };
}

export interface SignerShare {
  /** Path to this signer's frost-client config (holds its key share). */
  config: string;
  /**
   * Called with the message (hex) the coordinator asks this share to sign.
   * Return false to refuse — this is where the switch checks it is the pre-agreed heir payment.
   */
  approve: (messageHex: string) => boolean | Promise<boolean>;
}

export interface FrostSignRequest {
  serverUrl: string;
  groupPubKey: string;
  coordinatorConfig: string;
  /** Contact public keys of the shares that will sign (must be >= threshold). */
  signerPubkeys: string[];
  signers: SignerShare[];
  /** Transaction sighash (hex) — the message every spend authorizes. */
  sighash: string;
  /** One RedPallas randomizer (alpha, hex) per spend in the transaction. */
  randomizers: string[];
  workDir: string;
  onProgress?: (event: "round1" | "round2" | "aggregate", detail?: string) => void;
}

const hexToBytes = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));

/**
 * Run one FROST signing session through frostd and return one hex signature per randomizer.
 * The coordinator and each participant are separate frost-client processes, exactly as they
 * would be on separate devices.
 */
export async function frostSign(req: FrostSignRequest): Promise<string[]> {
  await mkdir(req.workDir, { recursive: true });
  const args = [
    "coordinator",
    "-c", req.coordinatorConfig,
    "--server-url", req.serverUrl,
    "--group", req.groupPubKey,
    "-S", req.signerPubkeys.join(","),
  ];
  const sigFiles: string[] = [];
  for (const [i, alpha] of req.randomizers.entries()) {
    const msgFile = join(req.workDir, `message-${i}.bin`);
    const rndFile = join(req.workDir, `randomizer-${i}.bin`);
    const sigFile = join(req.workDir, `signature-${i}.bin`);
    await writeFile(msgFile, hexToBytes(req.sighash));
    await writeFile(rndFile, hexToBytes(alpha));
    args.push("-m", msgFile, "-r", rndFile, "-o", sigFile);
    sigFiles.push(sigFile);
  }

  const coordinator = new Interactive(bin("frost-client"), args);
  req.onProgress?.("round1", "session created on frostd");

  // Give the coordinator a moment to create the session, then start every participant.
  await Bun.sleep(2500);
  const participants = req.signers.map((s) => runParticipant(req, s));

  try {
    await Promise.all(participants);
    req.onProgress?.("round2", `${req.signers.length} signature shares sent`);
    await coordinator.done;
  } catch (err) {
    coordinator.kill();
    throw err;
  }
  req.onProgress?.("aggregate", "signature shares combined");
  return Promise.all(sigFiles.map(async (f) => Buffer.from(await readFile(f)).toString("hex")));
}

async function runParticipant(req: FrostSignRequest, share: SignerShare, attempt = 1): Promise<void> {
  const p = new Interactive(bin("frost-client"), [
    "participant",
    "-c", share.config,
    "--server-url", req.serverUrl,
    "--group", req.groupPubKey,
  ]);
  try {
    // One prompt per message in the signing package; answer each after checking it.
    for (let answered = 0; answered < req.randomizers.length; answered++) {
      const prompts = [...(await waitForPrompt(p, answered + 1)).matchAll(PROMPT_RE)];
      const messageHex = prompts[answered][1].toLowerCase();
      const ok = await share.approve(messageHex);
      p.write(ok ? "y" : "n");
      if (!ok) throw new Error(`share ${share.config} refused to sign ${messageHex.slice(0, 16)}…`);
    }
    await p.done;
  } catch (err) {
    p.kill();
    // The session may not exist yet when a participant starts; retry a few times.
    if (attempt < 5 && /session|not found|no active/i.test(String(err))) {
      await Bun.sleep(2000);
      return runParticipant(req, share, attempt + 1);
    }
    throw err;
  }
}

const PROMPT_RE = /Message to be signed \(hex-encoded\):\s*\n([0-9a-fA-F]+)\s*\nDo you want to sign it\? \(y\/n\)/g;

async function waitForPrompt(p: Interactive, count: number) {
  await p.waitFor(new RegExp(`(?:${PROMPT_RE.source}[\\s\\S]*?){${count}}`), 180_000);
  return p.output;
}
