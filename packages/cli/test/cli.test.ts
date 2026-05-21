/**
 * Smoke tests for the human-facing CLI. Spawns the real CLI as a subprocess
 * so we exercise the same code path users hit — argv parsing, exit codes,
 * stdout/stderr — not just the inner functions.
 *
 * Slow-ish (~hundreds of ms per spawn) but worth it; this is the contract
 * we ship.
 */

import { promises as fs } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { ensureFixture, FIXTURE_ZIP } from "../../parser/test/fixture.js";
import { runCli } from "./helpers.js";

let workDir: string;

beforeAll(async () => {
  await ensureFixture();
});

beforeEach(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "antigram-cli-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("antigram (no args / help)", () => {
  it("prints usage and exits 0 when no subcommand is given", async () => {
    const { stderr, code } = await runCli([]);
    expect(code).toBe(0);
    expect(stderr).toMatch(/usage:/i);
    expect(stderr).toMatch(/parse/);
    expect(stderr).toMatch(/reclaim/);
  });

  it("exits 2 with usage on an unknown subcommand", async () => {
    const { code, stderr } = await runCli(["nonsense"]);
    expect(code).toBe(2);
    expect(stderr).toMatch(/usage:/i);
  });
});

describe("antigram parse", () => {
  it("prints accurate stats against the synthetic fixture", async () => {
    const { stdout, stderr, code } = await runCli(["parse", FIXTURE_ZIP]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/posts parsed:\s+3\b/);
    expect(stdout).toMatch(/photos:\s+5\b/);
    expect(stdout).toMatch(/first post:\s+2016-05-17/);
    expect(stdout).toMatch(/last post:\s+2024-12-01/);
    // The synthetic fixture's malformed post (no media) surfaces as a warning.
    expect(stdout).toMatch(/1 warning/i);
    expect(stderr).toMatch(/\[antigram\] parse/);
  });

  it("exits 2 with usage when called with no zip path", async () => {
    const { code, stderr } = await runCli(["parse"]);
    expect(code).toBe(2);
    expect(stderr).toMatch(/usage: antigram parse/);
  });

  it("exits non-zero on a missing ZIP file", async () => {
    const { code, stderr } = await runCli(["parse", path.join(workDir, "nope.zip")]);
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/fatal|ENOENT|no such file/i);
  });
});

describe("antigram reclaim", () => {
  it("writes the expected folder structure end-to-end", async () => {
    const out = path.join(workDir, "out");
    const { code, stdout } = await runCli(["reclaim", FIXTURE_ZIP, out], {
      timeoutMs: 120_000,
    });
    expect(code).toBe(0);
    expect(stdout).toMatch(/Reclaimed 3 posts \(5 media\)/);

    // Year-month buckets exist.
    for (const ym of ["2016-05", "2023-11", "2024-12"]) {
      const dir = path.join(out, ym);
      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    }

    // Sidecar JSONs are written.
    const tempelhofSidecar = await fs
      .readdir(path.join(out, "_metadata", "2016-05"))
      .then((files) => files.find((f) => f.endsWith(".json")));
    expect(tempelhofSidecar).toBeDefined();
    const sidecar = JSON.parse(
      await fs.readFile(path.join(out, "_metadata", "2016-05", tempelhofSidecar!), "utf8"),
    );
    expect(sidecar.caption).toBe("Sunset over Tempelhof 🌅");
    expect(sidecar.location).toEqual({ latitude: 52.473411, longitude: 13.40339 });

    // _archive_info.json reflects accurate stats.
    const info = JSON.parse(await fs.readFile(path.join(out, "_archive_info.json"), "utf8"));
    expect(info.stats.postCount).toBe(3);
    expect(info.stats.photoCount).toBe(5);
    expect(info.stats.yearsCovered).toEqual([2016, 2023, 2024]);
  });

  it("--limit N caps the number of posts processed", async () => {
    const out = path.join(workDir, "out");
    const { code, stdout } = await runCli(
      ["reclaim", FIXTURE_ZIP, out, "--limit=1"],
      { timeoutMs: 60_000 },
    );
    expect(code).toBe(0);
    expect(stdout).toMatch(/Reclaimed 1 posts/);
    const info = JSON.parse(await fs.readFile(path.join(out, "_archive_info.json"), "utf8"));
    expect(info.stats.postCount).toBe(1);
  });

  it("--no-metadata skips EXIF embedding (still writes files + sidecars)", async () => {
    const out = path.join(workDir, "out");
    const { code } = await runCli(
      ["reclaim", FIXTURE_ZIP, out, "--no-metadata"],
      { timeoutMs: 60_000 },
    );
    expect(code).toBe(0);
    const files = await fs.readdir(path.join(out, "2016-05"));
    expect(files.length).toBeGreaterThan(0);
  });

  it("exits 2 with usage when called with no args", async () => {
    const { code, stderr } = await runCli(["reclaim"]);
    expect(code).toBe(2);
    expect(stderr).toMatch(/usage: antigram reclaim/);
  });
});

describe("antigram doctor", () => {
  it("prints the runtime info to stderr", async () => {
    const { code, stderr } = await runCli(["doctor"]);
    expect(code).toBe(0);
    expect(stderr).toMatch(/\[antigram\] node v/);
  });
});
