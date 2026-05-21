/**
 * Synthetic Meta export fixture. Importable by tests (call `ensureFixture`
 * once per test file in `beforeAll`) and by the CLI in scripts/.
 *
 * The fixture mirrors the documented Meta export shape closely enough to
 * exercise: posts discovery, comments join, mojibake fix, multi-photo
 * carousels, location lift, and edge cases (post with no media, orphan
 * comment).
 *
 * Image bytes are placeholder — not valid JPEGs. The parser only needs the
 * JSON; pipeline tests that touch image content come later.
 */

import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yazl from "yazl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const FIXTURE_DIR = path.resolve(__dirname, "..", "fixtures");
export const FIXTURE_ZIP = path.join(FIXTURE_DIR, "synthetic-export.zip");
export const FIXTURE_MANIFEST = path.join(FIXTURE_DIR, "manifest.json");

// ---------------------------------------------------------------------------
// Synthetic data. Captions intentionally include Meta-style mojibake so the
// fixer is exercised end-to-end.
// ---------------------------------------------------------------------------

export const FIXTURE_POSTS = [
  {
    creation_timestamp: 1463486400, // 2016-05-17 12:00:00 UTC
    title: "Sunset over Tempelhof ðŸŒ…",
    media: [
      {
        uri: "media/posts/201605/1234567890_0.jpg",
        creation_timestamp: 1463486400,
        media_metadata: {
          photo_metadata: {
            exif_data: [
              {
                latitude: 52.473411,
                longitude: 13.40339,
                camera_make: "Apple",
                camera_model: "iPhone 6s",
                focal_length: "4.150000",
                aperture: "2.275007124536715",
                shutter_speed: "0.0006667",
                iso: 32,
                software: "9.3.2",
              },
            ],
          },
        },
      },
    ],
  },
  {
    creation_timestamp: 1700055600, // 2023-11-15 13:40:00 UTC
    title: "Three views from the same morning",
    media: [
      {
        uri: "media/posts/202311/9999999990_0.jpg",
        creation_timestamp: 1700055600,
        media_metadata: {
          photo_metadata: {
            exif_data: [{ camera_make: "Fujifilm", camera_model: "X-T4" }],
          },
        },
      },
      {
        uri: "media/posts/202311/9999999990_1.jpg",
        creation_timestamp: 1700055700,
        media_metadata: {
          photo_metadata: {
            exif_data: [{ camera_make: "Fujifilm", camera_model: "X-T4" }],
          },
        },
      },
      {
        uri: "media/posts/202311/9999999990_2.jpg",
        creation_timestamp: 1700055800,
        media_metadata: {
          photo_metadata: {
            exif_data: [{ camera_make: "Fujifilm", camera_model: "X-T4" }],
          },
        },
      },
    ],
  },
  {
    creation_timestamp: 1733011200, // 2024-12-01 00:00:00 UTC
    title: "",
    media: [
      {
        uri: "media/posts/202412/2222222222_0.jpg",
        creation_timestamp: 1733011200,
      },
    ],
  },
  // Edge case: malformed post — no media. Parser should skip it.
  {
    creation_timestamp: 1500000000,
    title: "Lonely caption with no photo",
    media: [],
  },
];

export const FIXTURE_COMMENTS = {
  comments: [
    {
      string_map_data: {
        Comment: { value: "Beautiful! Where is this?", timestamp: 1463486500 },
        Time: { timestamp: 1463486500 },
      },
      title: "anna_b",
      media_list_data: [{ uri: "media/posts/201605/1234567890_0.jpg" }],
    },
    {
      string_map_data: {
        Comment: { value: "Tempelhofer Feld! Iconic ðŸ™Œ", timestamp: 1463486800 },
        Time: { timestamp: 1463486800 },
      },
      title: "berlin_walks",
      media_list_data: [{ uri: "media/posts/201605/1234567890_0.jpg" }],
    },
    {
      string_map_data: {
        Comment: { value: "These are great!", timestamp: 1700056000 },
        Time: { timestamp: 1700056000 },
      },
      title: "friend1",
      media_list_data: [{ uri: "media/posts/202311/9999999990_0.jpg" }],
    },
    // Orphan comment — refers to a URI not in any post.
    {
      string_map_data: {
        Comment: { value: "this references nothing", timestamp: 1500000000 },
      },
      title: "ghost",
      media_list_data: [{ uri: "media/posts/199001/orphan.jpg" }],
    },
  ],
};

export const FIXTURE_ACCOUNT_INFO = {
  profile_account_insights: [],
  account_information: { username: "test_user", emails: [] },
};

// 1x1 white JPEG (134 bytes). Verified valid against exiftool & Pillow so
// the end-to-end pipeline can embed metadata without errors.
export const PLACEHOLDER_JPEG_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U" +
    "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN" +
    "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy" +
    "MjIyMjL/wAARCAABAAEDASIAAhEBAxEA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAU" +
    "EAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAA" +
    "AAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/APvD/9k=",
  "base64",
);

// ---------------------------------------------------------------------------
// Builder.
// ---------------------------------------------------------------------------

export interface FixtureManifest {
  zipPath: string;
  postCount: number;
  rawPostCount: number;
  mediaCount: number;
  commentCount: number;
}

export async function buildFixture(zipPath: string = FIXTURE_ZIP): Promise<FixtureManifest> {
  await fs.mkdir(path.dirname(zipPath), { recursive: true });

  const zip = new yazl.ZipFile();

  zip.addBuffer(Buffer.from(JSON.stringify(FIXTURE_POSTS, null, 2)), "content/posts_1.json");
  zip.addBuffer(
    Buffer.from(JSON.stringify(FIXTURE_COMMENTS, null, 2)),
    "comments/post_comments_1.json",
  );
  zip.addBuffer(
    Buffer.from(JSON.stringify(FIXTURE_ACCOUNT_INFO, null, 2)),
    "personal_information/account_information.json",
  );

  for (const post of FIXTURE_POSTS) {
    for (const m of post.media) {
      zip.addBuffer(PLACEHOLDER_JPEG_BYTES, m.uri);
    }
  }

  zip.end();

  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(zipPath);
    zip.outputStream
      .pipe(out)
      .on("close", () => resolve())
      .on("error", reject);
  });

  const manifest: FixtureManifest = {
    zipPath,
    postCount: FIXTURE_POSTS.filter((p) => p.media.length > 0).length,
    rawPostCount: FIXTURE_POSTS.length,
    mediaCount: FIXTURE_POSTS.flatMap((p) => p.media).length,
    commentCount: FIXTURE_COMMENTS.comments.length,
  };
  await fs.writeFile(FIXTURE_MANIFEST, JSON.stringify(manifest, null, 2));

  return manifest;
}

/**
 * Build the fixture only if it doesn't already exist or is older than this
 * source file. Cheap enough to call in `beforeAll`.
 */
export async function ensureFixture(): Promise<FixtureManifest> {
  try {
    const [zipStat, srcStat] = await Promise.all([fs.stat(FIXTURE_ZIP), fs.stat(__filename)]);
    if (zipStat.mtimeMs >= srcStat.mtimeMs) {
      try {
        return JSON.parse(await fs.readFile(FIXTURE_MANIFEST, "utf8")) as FixtureManifest;
      } catch {
        // fall through to rebuild
      }
    }
  } catch {
    // fall through to build
  }
  return buildFixture();
}
