/**
 * Test the organizer end-to-end against the synthetic parser fixture.
 * Uses a no-op MetadataEmbedder (we test the real one in @antigram/metadata).
 */

import { promises as fs } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parseExport } from "@antigram/parser";
import { ensureFixture, FIXTURE_ZIP } from "../../parser/test/fixture.js";
import {
  buildArchiveInfo,
  organizePost,
  writeArchiveInfo,
  type MediaSource,
  type MetadataEmbedder,
} from "../src/index.js";

const noopMetadata: MetadataEmbedder = {
  async writeForMedia() {
    /* intentionally empty */
  },
};

let workDir: string;

beforeAll(async () => {
  await ensureFixture();
});

beforeEach(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "antigram-organize-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("organizePost (integration with parser fixture)", () => {
  it("writes carousel photos to the correct year-month bucket with _NofM filenames", async () => {
    const { posts, discovery } = await parseExport(FIXTURE_ZIP, { keepOpen: true });
    try {
      const carousel = posts.find((p) => p.media.length > 1)!;
      const source: MediaSource = {
        openEntryStream: (uri) => discovery.zip.openEntryStream(uri),
      };

      const result = await organizePost(carousel, {
        outputRoot: workDir,
        source,
        metadata: noopMetadata,
      });

      expect(result.mediaPaths).toHaveLength(3);
      expect(result.warnings).toEqual([]);
      for (const p of result.mediaPaths) {
        const stat = await fs.stat(p);
        expect(stat.size).toBeGreaterThan(0);
        expect(p.includes(`2023-11${path.sep}`)).toBe(true);
      }

      const filenames = result.mediaPaths.map((p) => path.basename(p));
      expect(filenames.some((n) => n.endsWith("_1of3.jpg"))).toBe(true);
      expect(filenames.some((n) => n.endsWith("_2of3.jpg"))).toBe(true);
      expect(filenames.some((n) => n.endsWith("_3of3.jpg"))).toBe(true);
    } finally {
      await discovery.zip.close();
    }
  });

  it("writes a sidecar JSON next to the photos with caption and comments", async () => {
    const { posts, discovery } = await parseExport(FIXTURE_ZIP, { keepOpen: true });
    try {
      const tempelhof = posts.find((p) =>
        p.takenAt.toISOString().startsWith("2016-05-17"),
      )!;
      const source: MediaSource = {
        openEntryStream: (uri) => discovery.zip.openEntryStream(uri),
      };

      const result = await organizePost(tempelhof, {
        outputRoot: workDir,
        source,
        metadata: noopMetadata,
      });

      const sidecar = JSON.parse(await fs.readFile(result.sidecarPath, "utf8"));
      expect(sidecar.id).toBe(tempelhof.id);
      expect(sidecar.caption).toBe("Sunset over Tempelhof 🌅");
      expect(sidecar.takenAt).toBe("2016-05-17T12:00:00.000Z");
      expect(sidecar.location).toEqual({ latitude: 52.473411, longitude: 13.40339 });
      expect(sidecar.comments).toHaveLength(2);
      expect(sidecar.comments[0].text).toMatch(/Beautiful/);
      expect(sidecar.antigram.version).toBeTypeOf("string");
      expect(sidecar.antigram.reclaimedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      await discovery.zip.close();
    }
  });

  it("emits per-media progress callbacks", async () => {
    const { posts, discovery } = await parseExport(FIXTURE_ZIP, { keepOpen: true });
    try {
      const carousel = posts.find((p) => p.media.length > 1)!;
      const source: MediaSource = {
        openEntryStream: (uri) => discovery.zip.openEntryStream(uri),
      };
      const events: string[] = [];
      await organizePost(carousel, {
        outputRoot: workDir,
        source,
        metadata: noopMetadata,
        onMediaWritten: (e) => events.push(path.basename(e.absPath)),
      });
      expect(events).toHaveLength(3);
    } finally {
      await discovery.zip.close();
    }
  });

  it("collects a warning when a media URI is missing from the source", async () => {
    const post = (await parseExport(FIXTURE_ZIP)).posts[0]!;
    const failingSource: MediaSource = {
      openEntryStream() {
        return Promise.reject(new Error("ZIP entry not found: synthetic"));
      },
    };

    const result = await organizePost(post, {
      outputRoot: workDir,
      source: failingSource,
      metadata: noopMetadata,
    });

    expect(result.mediaPaths).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/ZIP entry not found/);
  });
});

describe("buildArchiveInfo / writeArchiveInfo", () => {
  it("captures counts, date range, and years covered", async () => {
    const { posts } = await parseExport(FIXTURE_ZIP);
    const info = buildArchiveInfo({ zipPath: FIXTURE_ZIP, posts });

    expect(info.stats.postCount).toBe(3);
    expect(info.stats.photoCount).toBe(5);
    expect(info.stats.videoCount).toBe(0);
    expect(info.stats.commentCount).toBe(3);
    expect(info.stats.firstPostAt).toBe("2016-05-17T12:00:00.000Z");
    expect(info.stats.lastPostAt).toBe("2024-12-01T00:00:00.000Z");
    expect(info.stats.yearsCovered).toEqual([2016, 2023, 2024]);
    expect(info.source.zipPath).toBe(FIXTURE_ZIP);
  });

  it("writes _archive_info.json at the output root", async () => {
    const { posts } = await parseExport(FIXTURE_ZIP);
    const info = buildArchiveInfo({ zipPath: FIXTURE_ZIP, posts });
    const written = await writeArchiveInfo(workDir, info);
    expect(path.basename(written)).toBe("_archive_info.json");
    const parsed = JSON.parse(await fs.readFile(written, "utf8"));
    expect(parsed.stats.postCount).toBe(3);
  });
});
