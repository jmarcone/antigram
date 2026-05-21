import { describe, expect, it } from "vitest";
import type { Media } from "@antigram/types";
import { buildExifTagSet, formatExifDate } from "../src/exif-tags.js";

function makeMedia(over: Partial<Media> = {}): Media {
  return {
    uri: "media/posts/202311/foo_0.jpg",
    filename: "foo_0.jpg",
    kind: "image",
    takenAt: new Date("2023-11-15T13:40:00Z"),
    indexInPost: 0,
    postMediaCount: 1,
    ...over,
  };
}

describe("formatExifDate", () => {
  it("formats UTC date in exiftool's expected shape", () => {
    expect(formatExifDate(new Date("2023-11-15T13:40:00Z"))).toBe("2023:11:15 13:40:00");
  });

  it("zero-pads months, days, hours, minutes, seconds", () => {
    expect(formatExifDate(new Date("2003-01-05T03:04:05Z"))).toBe("2003:01:05 03:04:05");
  });
});

describe("buildExifTagSet", () => {
  it("always sets DateTimeOriginal, CreateDate, ModifyDate", () => {
    const { tags } = buildExifTagSet(makeMedia(), "");
    expect(tags.DateTimeOriginal).toBe("2023:11:15 13:40:00");
    expect(tags.CreateDate).toBe("2023:11:15 13:40:00");
    expect(tags.ModifyDate).toBe("2023:11:15 13:40:00");
  });

  it("uses the post-level caption when the media has none", () => {
    const { tags } = buildExifTagSet(makeMedia(), "post caption");
    expect(tags.ImageDescription).toBe("post caption");
    expect(tags.XPComment).toBe("post caption");
  });

  it("prefers media-level caption over post-level", () => {
    const { tags } = buildExifTagSet(
      makeMedia({ caption: "media caption" }),
      "post caption",
    );
    expect(tags.ImageDescription).toBe("media caption");
  });

  it("omits caption tags when both captions are empty", () => {
    const { tags } = buildExifTagSet(makeMedia(), "");
    expect(tags.ImageDescription).toBeUndefined();
    expect(tags.XPComment).toBeUndefined();
  });

  it("encodes positive coordinates as N/E with absolute values", () => {
    const { tags } = buildExifTagSet(
      makeMedia({ location: { latitude: 52.473411, longitude: 13.40339 } }),
      "",
    );
    expect(tags.GPSLatitude).toBe(52.473411);
    expect(tags.GPSLatitudeRef).toBe("N");
    expect(tags.GPSLongitude).toBe(13.40339);
    expect(tags.GPSLongitudeRef).toBe("E");
  });

  it("encodes negative coordinates as S/W with absolute values", () => {
    const { tags } = buildExifTagSet(
      makeMedia({ location: { latitude: -33.86882, longitude: -151.20929 } }),
      "",
    );
    expect(tags.GPSLatitude).toBe(33.86882);
    expect(tags.GPSLatitudeRef).toBe("S");
    expect(tags.GPSLongitude).toBe(151.20929);
    expect(tags.GPSLongitudeRef).toBe("W");
  });

  it("omits GPS tags when location is missing", () => {
    const { tags } = buildExifTagSet(makeMedia(), "");
    expect(tags.GPSLatitude).toBeUndefined();
    expect(tags.GPSLatitudeRef).toBeUndefined();
  });

  it("passes camera fields through and stamps Antigram as the creator tool", () => {
    const { tags } = buildExifTagSet(
      makeMedia({
        camera: {
          make: "Apple",
          model: "iPhone 6s",
          lensModel: "iPhone 6s back camera 4.15mm f/2.2",
          software: "9.3.2",
          iso: 32,
        },
      }),
      "",
    );
    expect(tags.Make).toBe("Apple");
    expect(tags.Model).toBe("iPhone 6s");
    expect(tags.LensModel).toBe("iPhone 6s back camera 4.15mm f/2.2");
    expect(tags.Software).toBe("9.3.2");
    expect(tags.ISO).toBe(32);
    expect(tags["XMP-xmp:CreatorTool"]).toBe("Antigram");
  });

  it("includes -overwrite_original and a UTF-8 charset flag in extra args", () => {
    const { extraArgs } = buildExifTagSet(makeMedia(), "");
    expect(extraArgs).toContain("-overwrite_original");
    expect(extraArgs.some((a) => a.startsWith("-codedcharacterset="))).toBe(true);
  });
});
