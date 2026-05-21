/**
 * End-to-end integration test for MetadataWriter against a real JPEG file
 * using the real exiftool binary (bundled via exiftool-vendored).
 *
 * The JPEG is a hardcoded 134-byte 1x1 white image — verified valid against
 * Pillow and exiftool. Each test uses a fresh tempdir so the source bytes
 * stay clean.
 */

import { promises as fs } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { exiftool } from "exiftool-vendored";
import type { Media } from "@antigram/types";
import { MetadataWriter } from "../src/index.js";

const TINY_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/APvD/9k=";

let workDir: string;
let writer: MetadataWriter;

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "antigram-metadata-"));
  writer = new MetadataWriter();
});

afterAll(async () => {
  await writer.close();
  try {
    await rm(workDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

async function newTinyJpeg(name: string): Promise<string> {
  const target = path.join(workDir, name);
  await fs.writeFile(target, Buffer.from(TINY_JPEG_BASE64, "base64"));
  return target;
}

const baseMedia: Media = {
  uri: "media/posts/201605/tempelhof.jpg",
  filename: "tempelhof.jpg",
  kind: "image",
  takenAt: new Date("2016-05-17T12:00:00Z"),
  indexInPost: 0,
  postMediaCount: 1,
  location: { latitude: 52.473411, longitude: 13.40339 },
  camera: { make: "Apple", model: "iPhone 6s" },
};

describe("MetadataWriter (integration with bundled exiftool)", () => {
  let jpegPath: string;
  beforeEach(async () => {
    jpegPath = await newTinyJpeg(`fixture-${Math.random().toString(36).slice(2)}.jpg`);
  });

  it("writes DateTimeOriginal that Apple Photos / Lightroom can read", async () => {
    await writer.writeForMedia(jpegPath, baseMedia, "Sunset over Tempelhof 🌅");
    const tags = await exiftool.read(jpegPath);
    const dt = tags.DateTimeOriginal;
    expect(dt).toBeDefined();
    // exiftool-vendored parses to an ExifDateTime; check the wall-clock parts
    // we wrote, which don't depend on the host machine's timezone.
    expect(dt && (dt as { year: number }).year).toBe(2016);
    expect(dt && (dt as { month: number }).month).toBe(5);
    expect(dt && (dt as { day: number }).day).toBe(17);
    expect(dt && (dt as { hour: number }).hour).toBe(12);
    expect(dt && (dt as { minute: number }).minute).toBe(0);
  });

  it("writes GPS lat/lon with the correct hemisphere refs", async () => {
    await writer.writeForMedia(jpegPath, baseMedia, "");
    const tags = await exiftool.read(jpegPath);
    expect(tags.GPSLatitude).toBeCloseTo(52.473411, 4);
    expect(tags.GPSLongitude).toBeCloseTo(13.40339, 4);
    expect(tags.GPSLatitudeRef).toMatch(/^N/i);
    expect(tags.GPSLongitudeRef).toMatch(/^E/i);
  });

  it("preserves emoji in ImageDescription (caption round-trip)", async () => {
    const caption = "Sunset over Tempelhof 🌅";
    await writer.writeForMedia(jpegPath, baseMedia, caption);
    const tags = await exiftool.read(jpegPath);
    expect(tags.ImageDescription).toBe(caption);
  });

  it("writes camera Make/Model", async () => {
    await writer.writeForMedia(jpegPath, baseMedia, "");
    const tags = await exiftool.read(jpegPath);
    expect(tags.Make).toBe("Apple");
    expect(tags.Model).toBe("iPhone 6s");
  });

  it("stamps Antigram as the creator tool so we can detect our own writes", async () => {
    await writer.writeForMedia(jpegPath, baseMedia, "");
    const tags = await exiftool.read(jpegPath);
    expect(tags.CreatorTool).toBe("Antigram");
  });

  it("does not leave a .original sidecar behind", async () => {
    await writer.writeForMedia(jpegPath, baseMedia, "ok");
    const sideExists = await fs
      .stat(`${jpegPath}_original`)
      .then(() => true)
      .catch(() => false);
    expect(sideExists).toBe(false);
  });
});
