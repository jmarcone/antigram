/**
 * Test helpers for spawning the CLI as a real subprocess.
 *
 * Both the human-facing CLI (src/index.ts) and the Tauri sidecar
 * (src/sidecar.ts) are spawned via Node + the locally-resolved tsx loader.
 * No pnpm/yarn/npx in the spawn — fully cross-platform.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);

export const PACKAGE_DIR = path.resolve(__dirname, "..");
export const FIXTURE_ZIP = path.resolve(
  __dirname,
  "..",
  "..",
  "parser",
  "fixtures",
  "synthetic-export.zip",
);
export const SIDECAR_BUNDLE = path.join(PACKAGE_DIR, "dist", "sidecar.cjs");

/** Absolute path to tsx's CLI entry (works on Windows + Unix). */
export const TSX_CLI: string = (() => {
  const pkgPath = require.resolve("tsx/package.json");
  return path.join(path.dirname(pkgPath), "dist", "cli.mjs");
})();

export const CLI_ENTRY = path.join(PACKAGE_DIR, "src", "index.ts");
export const SIDECAR_ENTRY = path.join(PACKAGE_DIR, "src", "sidecar.ts");

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

interface RunOpts {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

/** Run any node script with the given args. Returns once the process exits. */
export function runNode(
  scriptArgs: readonly string[],
  opts: RunOpts = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, scriptArgs, {
      cwd: opts.cwd ?? PACKAGE_DIR,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          child.kill();
          reject(new Error(`runNode timed out after ${opts.timeoutMs} ms`));
        }, opts.timeoutMs)
      : null;
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    child.on("exit", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? -1 });
    });
  });
}

/** Run the human CLI as `node tsx-cli.mjs src/index.ts <args>`. */
export async function runCli(args: readonly string[], opts: RunOpts = {}): Promise<RunResult> {
  return runNode([TSX_CLI, CLI_ENTRY, ...args], opts);
}

/** Run the sidecar via tsx (source) — for fast iteration. */
export async function runSidecarTsx(
  args: readonly string[],
  opts: RunOpts = {},
): Promise<RunResult> {
  return runNode([TSX_CLI, SIDECAR_ENTRY, ...args], opts);
}

/** Run the sidecar's bundled CJS — what Tauri actually spawns in production. */
export async function runSidecarBundle(
  args: readonly string[],
  opts: RunOpts = {},
): Promise<RunResult> {
  return runNode([SIDECAR_BUNDLE, ...args], opts);
}

/** Parse NDJSON output into envelope objects. Ignores empty lines. */
export function parseNdjson<T = unknown>(text: string): T[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as T);
}
