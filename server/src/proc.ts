import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";

export const BIN_DIR = process.env.ZECHEIR_BIN_DIR ?? join(import.meta.dir, "..", "..", "tools", "bin");
export const bin = (name: "frost-client" | "zcash-sign" | "zcash-devtool") => join(BIN_DIR, name);

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** Run a CLI to completion. Rejects on non-zero exit with stderr in the message. */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; stdin?: string | Uint8Array; timeoutMs?: number } = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} ${args[0]} timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs ?? 300_000);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr, code });
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}: ${(stderr || stdout).slice(-800)}`));
    });
    if (opts.stdin !== undefined) child.stdin.end(opts.stdin);
    else child.stdin.end();
  });
}

/**
 * An interactive CLI session: lets us wait for prompts on stdout and answer them,
 * which `zcash-sign sign` and `frost-client participant` require.
 */
export class Interactive {
  readonly child: ChildProcessWithoutNullStreams;
  private out = "";
  private waiters: Array<{ re: RegExp; resolve: (m: RegExpMatchArray) => void }> = [];
  readonly done: Promise<RunResult>;

  constructor(cmd: string, args: string[], opts: { cwd?: string } = {}) {
    this.child = spawn(cmd, args, { cwd: opts.cwd });
    let stderr = "";
    const tag = `${cmd.split("/").pop()} ${args[0]} ${args[2] ?? ""}`;
    const onData = (d: Buffer) => {
      this.out += d.toString();
      if (process.env.ZECHEIR_DEBUG) process.stderr.write(`[${tag}] ${d}`);
      this.flush();
    };
    this.child.stdout.on("data", onData);
    this.child.stderr.on("data", (d) => {
      stderr += d;
      onData(d);
    });
    this.done = new Promise((resolve, reject) => {
      this.child.on("error", reject);
      this.child.on("close", (code) => {
        if (code === 0) resolve({ stdout: this.out, stderr, code });
        else reject(new Error(`${cmd} ${args[0]} exited ${code}: ${this.out.slice(-800)}`));
      });
    });
  }

  get output() {
    return this.out;
  }

  private flush() {
    this.waiters = this.waiters.filter((w) => {
      const m = this.out.match(w.re);
      if (m) w.resolve(m);
      return !m;
    });
  }

  /** Resolve once stdout/stderr (accumulated) matches `re`. */
  waitFor(re: RegExp, timeoutMs = 120_000): Promise<RegExpMatchArray> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${re}; output: ${this.out.slice(-500)}`)), timeoutMs);
      this.waiters.push({
        re,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      });
      this.flush();
      this.done.catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  write(line: string) {
    this.child.stdin.write(line.endsWith("\n") ? line : `${line}\n`);
  }

  kill() {
    this.child.kill("SIGKILL");
  }
}
