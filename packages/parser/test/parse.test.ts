import { beforeAll, describe, expect, it } from "vitest";
import { parseExport } from "../src/parse.js";
import { ensureFixture, FIXTURE_ZIP } from "./fixture.js";

beforeAll(async () => {
  await ensureFixture();
});

describe("parseExport (against synthetic fixture)", () => {
  it("returns three posts, sorted newest-first", async () => {
    const { posts, warnings } = await parseExport(FIXTURE_ZIP);

    expect(posts).toHaveLength(3);
    expect(posts.map((p) => p.takenAt.toISOString())).toEqual([
      "2024-12-01T00:00:00.000Z",
      "2023-11-15T13:40:00.000Z",
      "2016-05-17T12:00:00.000Z",
    ]);

    // The fourth raw post has no media, which we surface as a warning.
    expect(warnings.some((w) => /no media/i.test(w))).toBe(true);
  });

  it("decodes mojibake'd captions and comments", async () => {
    const { posts } = await parseExport(FIXTURE_ZIP);
    const tempelhof = posts.find((p) => p.takenAt.toISOString().startsWith("2016-05-17"));
    expect(tempelhof).toBeDefined();
    expect(tempelhof!.caption).toBe("Sunset over Tempelhof 🌅");

    const commentTexts = tempelhof!.comments.map((c) => c.text);
    expect(commentTexts).toContain("Beautiful! Where is this?");
    expect(commentTexts).toContain("Tempelhofer Feld! Iconic 🙌");
  });

  it("lifts GPS from EXIF into Post.location", async () => {
    const { posts } = await parseExport(FIXTURE_ZIP);
    const tempelhof = posts.find((p) => p.takenAt.toISOString().startsWith("2016-05-17"))!;
    expect(tempelhof.location).toEqual({
      latitude: 52.473411,
      longitude: 13.40339,
    });
  });

  it("preserves carousel grouping with correct indexInPost / postMediaCount", async () => {
    const { posts } = await parseExport(FIXTURE_ZIP);
    const carousel = posts.find((p) => p.media.length > 1)!;
    expect(carousel.media).toHaveLength(3);
    expect(carousel.media.map((m) => m.indexInPost)).toEqual([0, 1, 2]);
    expect(carousel.media.every((m) => m.postMediaCount === 3)).toBe(true);
    expect(carousel.media.map((m) => m.filename)).toEqual([
      "9999999990_0.jpg",
      "9999999990_1.jpg",
      "9999999990_2.jpg",
    ]);
  });

  it("classifies media as image by file extension", async () => {
    const { posts } = await parseExport(FIXTURE_ZIP);
    expect(posts.flatMap((p) => p.media).every((m) => m.kind === "image")).toBe(true);
  });

  it("extracts camera info when present, omits when not", async () => {
    const { posts } = await parseExport(FIXTURE_ZIP);
    const tempelhof = posts.find((p) => p.takenAt.toISOString().startsWith("2016-05-17"))!;
    expect(tempelhof.media[0]?.camera).toMatchObject({
      make: "Apple",
      model: "iPhone 6s",
    });

    const dec2024 = posts.find((p) => p.takenAt.toISOString().startsWith("2024-12-01"))!;
    expect(dec2024.media[0]?.camera).toBeUndefined();
  });

  it("emits stable, sortable post ids", async () => {
    const a = (await parseExport(FIXTURE_ZIP)).posts;
    const b = (await parseExport(FIXTURE_ZIP)).posts;
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
    for (const p of a) expect(p.id).toMatch(/^post_[a-z0-9]+_c\d+_i\d+$/);
  });
});
