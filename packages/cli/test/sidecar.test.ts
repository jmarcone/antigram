/**
 * Tests the NDJSON envelope protocol the Tauri sidecar emits. This is the
 * Rust↔Node contract: if we change the wire format here, the Tauri side
 * stops working.
 *
 * Tests run against the bundled `dist/sidecar.cjs` when present (that's the
 * artifact Tauri ships), falling back to the tsx source otherwise. CI
 * builds the bundle before running tests.
 */

import { promises as fs } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { ensureFixture, FIXTURE_ZIP } from "../../parser/test/fixture.js";
import {
  parseNdjson,
  runSidecarBundle,
  runSidecarTsx,
  SIDECAR_BUNDLE,
  PACKAGE_DIR,
  TSX_CLI,
} from "./helpers.js";

let bundleAvailable = false;
let workDir: string;

beforeAll(async () => {
  await ensureFixture();
  bundleAvailable = await fs
    .stat(SIDECAR_BUNDLE)
    .then((s) => s.isFile())
    .catch(() => false);
  if (!bundleAvailable) {
    // Best-effort: try to build it so the suite is self-contained.
    const result = spawnSync(process.execPath, [TSX_CLI, "node_modules/tsup/dist/cli-default.js"], {
      cwd: PACKAGE_DIR,
    });
    bundleAvailable =
      result.status === 0 &&
      (await fs.stat(SIDECAR_BUNDLE).then((s) => s.isFile()).catch(() => false));
  }
});

beforeEach(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "antigram-sidecar-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

/** Pick the runner (bundle when available, tsx source otherwise). */
function runSidecar(args: readonly string[]) {
  return bundleAvailable ? runSidecarBundle(args) : runSidecarTsx(args);
}

interface EnvelopeBase {
  k: string;
}

describe("sidecar protocol — parse", () => {
  it("emits one discovery envelope and one parsed envelope, in that order", async () => {
    const { stdout, code } = await runSidecar(["parse", FIXTURE_ZIP]);
    expect(code).toBe(0);
    const envelopes = parseNdjson<EnvelopeBase>(stdout);
    expect(envelopes.map((e) => e.k)).toEqual(["discovery", "parsed"]);
  });

  it("discovery envelope carries postsJsonCount, mediaCount, exportVersion", async () => {
    const { stdout } = await runSidecar(["parse", FIXTURE_ZIP]);
    const [discovery] = parseNdjson<{
      k: string;
      postsJsonCount: number;
      mediaCount: number;
      exportVersion: string | null;
    }>(stdout);
    expect(discovery?.k).toBe("discovery");
    expect(discovery?.postsJsonCount).toBe(1);
    expect(discovery?.mediaCount).toBe(5);
    expect(discovery?.exportVersion).toBe("pre-2024");
  });

  it("parsed envelope carries de-mojibake'd captions and ISO-string dates (no Date objects)", async () => {
    const { stdout } = await runSidecar(["parse", FIXTURE_ZIP]);
    const envs = parseNdjson<{
      k: string;
      posts?: Array<{ id: string; caption: string; takenAt: string; takenYear: number }>;
    }>(stdout);
    const parsed = envs.find((e) => e.k === "parsed");
    expect(parsed?.posts).toBeDefined();
    const posts = parsed!.posts!;
    expect(posts.length).toBe(3);
    const tempelhof = posts.find((p) => p.takenAt.startsWith("2016-05-17"));
    expect(tempelhof?.caption).toBe("Sunset over Tempelhof 🌅");
    expect(typeof tempelhof?.takenAt).toBe("string");
    expect(tempelhof?.takenYear).toBe(2016);
  });

  it("emits an error envelope and exits non-zero on a missing ZIP", async () => {
    const { stdout, code } = await runSidecar([
      "parse",
      path.join(workDir, "does-not-exist.zip"),
    ]);
    expect(code).not.toBe(0);
    const envs = parseNdjson<{ k: string; message?: string }>(stdout);
    const err = envs.find((e) => e.k === "error");
    expect(err).toBeDefined();
    expect(err!.message).toBeTypeOf("string");
  });
});

describe("sidecar protocol — reclaim", () => {
  it("emits reclaim_start, post_start*, media_written*, post_done*, done in order", async () => {
    const out = path.join(workDir, "out");
    const { stdout, code } = await runSidecar(["reclaim", FIXTURE_ZIP, out]);
    expect(code).toBe(0);

    const envs = parseNdjson<EnvelopeBase>(stdout);
    const kinds = envs.map((e) => e.k);

    expect(kinds[0]).toBe("reclaim_start");
    expect(kinds.at(-1)).toBe("done");

    // Three posts in the fixture, each emits a post_start and a post_done.
    expect(kinds.filter((k) => k === "post_start")).toHaveLength(3);
    expect(kinds.filter((k) => k === "post_done")).toHaveLength(3);
    // Five media files written total.
    expect(kinds.filter((k) => k === "media_written")).toHaveLength(5);
  });

  it("post_start / post_done envelopes carry index, total, postId", async () => {
    const out = path.join(workDir, "out");
    const { stdout } = await runSidecar(["reclaim", FIXTURE_ZIP, out]);
    const envs = parseNdjson<{
      k: string;
      postId?: string;
      index?: number;
      total?: number;
    }>(stdout);
    const starts = envs.filter((e) => e.k === "post_start");
    expect(starts.map((e) => e.index)).toEqual([0, 1, 2]);
    expect(starts.every((e) => e.total === 3)).toBe(true);
    expect(starts.every((e) => typeof e.postId === "string")).toBe(true);
  });

  it("media_written envelope carries an absolute filesystem path", async () => {
    const out = path.join(workDir, "out");
    const { stdout } = await runSidecar(["reclaim", FIXTURE_ZIP, out]);
    const envs = parseNdjson<{ k: string; absPath?: string }>(stdout);
    const mw = envs.filter((e) => e.k === "media_written");
    expect(mw.length).toBeGreaterThan(0);
    for (const e of mw) {
      expect(e.absPath).toBeTypeOf("string");
      expect(path.isAbsolute(e.absPath!)).toBe(true);
    }
  });

  it("done envelope carries outputRoot, mediaWritten, warnings[]", async () => {
    const out = path.join(workDir, "out");
    const { stdout } = await runSidecar(["reclaim", FIXTURE_ZIP, out]);
    const envs = parseNdjson<{
      k: string;
      outputRoot?: string;
      mediaWritten?: number;
      warnings?: string[];
    }>(stdout);
    const done = envs.find((e) => e.k === "done");
    expect(done).toBeDefined();
    expect(done!.mediaWritten).toBe(5);
    expect(done!.outputRoot).toBeTypeOf("string");
    expect(Array.isArray(done!.warnings)).toBe(true);
  });

  it("--post-id filter narrows the run to specific posts", async () => {
    const parseRes = await runSidecar(["parse", FIXTURE_ZIP]);
    const parsedEnv = parseNdjson<{ k: string; posts?: Array<{ id: string }> }>(parseRes.stdout).find(
      (e) => e.k === "parsed",
    );
    const firstId = parsedEnv!.posts![0]!.id;

    const out = path.join(workDir, "out");
    const { stdout } = await runSidecar(["reclaim", FIXTURE_ZIP, out, "--post-id", firstId]);
    const envs = parseNdjson<{ k: string; mediaWritten?: number; total?: number }>(stdout);
    const start = envs.find((e) => e.k === "reclaim_start");
    expect(start?.total).toBe(1);
    const done = envs.find((e) => e.k === "done");
    expect(done?.mediaWritten).toBeGreaterThan(0);
    expect(done?.mediaWritten).toBeLessThanOrEqual(3); // carousels max out at 3 in the fixture
  });
});

describe("sidecar protocol — error handling", () => {
  it("unknown commands emit an error envelope and exit non-zero", async () => {
    const { stdout, code } = await runSidecar(["this-is-not-a-command"]);
    expect(code).not.toBe(0);
    const envs = parseNdjson<{ k: string; message?: string }>(stdout);
    expect(envs.find((e) => e.k === "error")).toBeDefined();
  });

  it("reclaim with missing args emits an error envelope", async () => {
    const { stdout, code } = await runSidecar(["reclaim"]);
    expect(code).not.toBe(0);
    const envs = parseNdjson<{ k: string; message?: string }>(stdout);
    const err = envs.find((e) => e.k === "error");
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/missing/i);
  });
});
