import { describe, expect, it } from "vitest";
import type { Media, Post } from "@antigram/types";
import {
  bucketForMedia,
  bucketForPost,
  mediaOutputLayout,
  postSidecarLayout,
  shortPostHash,
} from "../src/paths.js";

function makePost(over: Partial<Post> = {}): Post {
  return {
    id: "post_xkywbe_c0_i0",
    caption: "Sunset over Tempelhof 🌅",
    takenAt: new Date("2016-05-17T12:00:00Z"),
    media: [],
    comments: [],
    ...over,
  };
}

function makeMedia(over: Partial<Media> = {}): Media {
  return {
    uri: "media/posts/201605/foo_0.jpg",
    filename: "foo_0.jpg",
    kind: "image",
    takenAt: new Date("2016-05-17T12:00:00Z"),
    indexInPost: 0,
    postMediaCount: 1,
    ...over,
  };
}

describe("bucketForPost / bucketForMedia", () => {
  it("returns YYYY-MM from UTC takenAt", () => {
    expect(bucketForPost(makePost())).toBe("2016-05");
    expect(bucketForMedia(makeMedia())).toBe("2016-05");
  });

  it("zero-pads single-digit months", () => {
    const post = makePost({ takenAt: new Date("2020-03-01T00:00:00Z") });
    expect(bucketForPost(post)).toBe("2020-03");
  });
});

describe("shortPostHash", () => {
  it("returns a stable 8-char hex string", () => {
    const a = shortPostHash("post_a");
    const b = shortPostHash("post_a");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it("returns different hashes for different post ids", () => {
    expect(shortPostHash("post_a")).not.toBe(shortPostHash("post_b"));
  });
});

describe("mediaOutputLayout", () => {
  it("builds the canonical path for a single-photo post", () => {
    const layout = mediaOutputLayout("/out", makePost(), makeMedia());
    expect(layout.bucketDir).toBe("2016-05");
    expect(layout.filename).toMatch(
      /^2016-05-17_120000_post_[0-9a-f]{8}_1of1\.jpg$/,
    );
    // path.join uses platform separator; on Windows that's "\".
    expect(layout.absPath).toContain("2016-05");
    expect(layout.absPath.endsWith(layout.filename)).toBe(true);
  });

  it("builds carousel filenames as _1of3, _2of3, _3of3", () => {
    const post = makePost();
    const layouts = [0, 1, 2].map((i) =>
      mediaOutputLayout(
        "/out",
        post,
        makeMedia({
          uri: `media/posts/201605/foo_${i}.jpg`,
          filename: `foo_${i}.jpg`,
          indexInPost: i,
          postMediaCount: 3,
        }),
      ),
    );
    expect(layouts.map((l) => l.filename)).toEqual([
      expect.stringMatching(/_1of3\.jpg$/),
      expect.stringMatching(/_2of3\.jpg$/),
      expect.stringMatching(/_3of3\.jpg$/),
    ]);
  });

  it("preserves the media's extension", () => {
    const layout = mediaOutputLayout(
      "/out",
      makePost(),
      makeMedia({ uri: "media/posts/202101/vid.mp4", filename: "vid.mp4", kind: "video" }),
    );
    expect(layout.filename.endsWith(".mp4")).toBe(true);
  });

  it("defaults to .jpg when extension is missing", () => {
    const layout = mediaOutputLayout(
      "/out",
      makePost(),
      makeMedia({ uri: "media/posts/201605/foo", filename: "foo" }),
    );
    expect(layout.filename.endsWith(".jpg")).toBe(true);
  });
});

describe("postSidecarLayout", () => {
  it("puts sidecars in _metadata/YYYY-MM/", () => {
    const layout = postSidecarLayout("/out", makePost());
    expect(layout.relPath).toBe("_metadata/2016-05/post_xkywbe_c0_i0.json");
    expect(layout.absPath.endsWith("post_xkywbe_c0_i0.json")).toBe(true);
  });
});
