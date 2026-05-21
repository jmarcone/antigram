/**
 * Builds a richer "demo" Meta export ZIP suitable for demo videos and
 * trying out the desktop UI. Bigger and more varied than the test fixture:
 *
 *   - 18 posts spanning 2014–2024 (good for the year-filter dropdown)
 *   - mix of single photos and carousels (2–4 media)
 *   - emoji-heavy captions, captions with cp1252 mojibake, empty captions
 *   - GPS coordinates from multiple cities
 *   - comments on most posts (some with mojibake too)
 *
 * Output: <repo>/demo-export.zip
 *
 * Drop the resulting ZIP into Antigram (`pnpm tauri:dev`) and pick "Read my
 * export" to see the gallery populated.
 */

import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yazl from "yazl";
import { PLACEHOLDER_JPEG_BYTES } from "../test/fixture.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEMO_ZIP = path.join(REPO_ROOT, "demo-export.zip");

interface DemoPost {
  ts: number; // epoch seconds
  caption: string;
  mediaCount: number;
  yearMonthFolder: string;
  baseId: string;
  location?: { lat: number; lon: number };
  camera?: { make: string; model: string };
  comments?: Array<{ text: string; author: string; offsetSec: number }>;
}

// Captions intentionally include cp1252-mojibake'd emojis (Meta's export
// quirk). The pipeline restores them on load.
const DEMO_POSTS: DemoPost[] = [
  {
    ts: 1399723200, // 2014-05-10 12:00 UTC
    caption: "First post on this account. Hi internet ðŸ‘‹",
    mediaCount: 1,
    yearMonthFolder: "201405",
    baseId: "AABB0001",
    location: { lat: 41.4036, lon: 2.1744 }, // Barcelona
    camera: { make: "Apple", model: "iPhone 4S" },
    comments: [
      { text: "welcome!! ðŸŽ‰", author: "old_friend_99", offsetSec: 120 },
      { text: "about time you joined", author: "marta_garcia", offsetSec: 480 },
    ],
  },
  {
    ts: 1416960000, // 2014-11-26 00:00 UTC
    caption: "Snowstorm in the city. CafÃ© is the only place with power.",
    mediaCount: 1,
    yearMonthFolder: "201411",
    baseId: "AABB0002",
    location: { lat: 40.7128, lon: -74.006 }, // New York
    camera: { make: "Apple", model: "iPhone 5s" },
    comments: [{ text: "stay warm!", author: "mom", offsetSec: 60 }],
  },
  {
    ts: 1442880000, // 2015-09-22 00:00 UTC
    caption:
      "Hike along the coast. The photos donÌ¶Ì¶'t do it justice — you have to be there ðŸŒŠ",
    mediaCount: 3,
    yearMonthFolder: "201509",
    baseId: "AABB0003",
    location: { lat: 32.7157, lon: -117.1611 }, // San Diego
    camera: { make: "Apple", model: "iPhone 6" },
    comments: [{ text: "gorgeous!", author: "alex_p", offsetSec: 300 }],
  },
  {
    ts: 1463486400, // 2016-05-17 12:00 UTC
    caption: "Sunset over Tempelhof ðŸŒ…",
    mediaCount: 1,
    yearMonthFolder: "201605",
    baseId: "AABB0004",
    location: { lat: 52.473411, lon: 13.40339 }, // Berlin
    camera: { make: "Apple", model: "iPhone 6s" },
    comments: [
      { text: "Beautiful! Where is this?", author: "anna_b", offsetSec: 100 },
      {
        text: "Tempelhofer Feld! Iconic ðŸ™Œ",
        author: "berlin_walks",
        offsetSec: 400,
      },
    ],
  },
  {
    ts: 1477008000, // 2016-10-21 00:00 UTC
    caption: "",
    mediaCount: 1,
    yearMonthFolder: "201610",
    baseId: "AABB0005",
    location: { lat: 35.6895, lon: 139.6917 }, // Tokyo
    camera: { make: "Sony", model: "RX100 V" },
  },
  {
    ts: 1500076800, // 2017-07-15 00:00 UTC
    caption: "Best ramen in Osaka. Worth the line ðŸœ",
    mediaCount: 2,
    yearMonthFolder: "201707",
    baseId: "AABB0006",
    location: { lat: 34.6937, lon: 135.5023 },
    camera: { make: "Apple", model: "iPhone 7 Plus" },
    comments: [{ text: "drooling 🤤", author: "alex_p", offsetSec: 200 }],
  },
  {
    ts: 1526169600, // 2018-05-13 00:00 UTC
    caption: "MotherÌ¶Ì¶'s Day. She refused to be photographed but we got her.",
    mediaCount: 1,
    yearMonthFolder: "201805",
    baseId: "AABB0007",
    location: { lat: 41.9028, lon: 12.4964 }, // Rome
    camera: { make: "Apple", model: "iPhone 8" },
    comments: [
      { text: "she looks great", author: "uncle_d", offsetSec: 600 },
      { text: "tell her I miss her cooking", author: "cousin_emma", offsetSec: 1800 },
    ],
  },
  {
    ts: 1547337600, // 2019-01-13 00:00 UTC
    caption: "New year, same dog ðŸ¶",
    mediaCount: 4,
    yearMonthFolder: "201901",
    baseId: "AABB0008",
    location: { lat: 38.7223, lon: -9.1393 }, // Lisbon
    camera: { make: "Apple", model: "iPhone XS" },
    comments: [
      { text: "OMG SO CUTE", author: "anna_b", offsetSec: 60 },
      { text: "tell him I said hi", author: "old_friend_99", offsetSec: 7200 },
    ],
  },
  {
    ts: 1559606400, // 2019-06-04 00:00 UTC
    caption: "Concert was unreal. Ears still ringing.",
    mediaCount: 2,
    yearMonthFolder: "201906",
    baseId: "AABB0009",
    location: { lat: 51.5074, lon: -0.1278 }, // London
    camera: { make: "Apple", model: "iPhone XS" },
  },
  {
    ts: 1583020800, // 2020-03-01 00:00 UTC
    caption:
      "Last big party for a while, it turns out. Stay safe everyone ðŸ’›",
    mediaCount: 1,
    yearMonthFolder: "202003",
    baseId: "AABB0010",
    location: { lat: 48.8566, lon: 2.3522 }, // Paris
    camera: { make: "Apple", model: "iPhone 11" },
    comments: [
      { text: "miss this so much", author: "marta_garcia", offsetSec: 3600 },
    ],
  },
  {
    ts: 1601424000, // 2020-09-30 00:00 UTC
    caption:
      "Working from this view. Not mad about it ðŸŒ²",
    mediaCount: 1,
    yearMonthFolder: "202009",
    baseId: "AABB0011",
    location: { lat: 46.8523, lon: -121.7603 }, // Mt. Rainier-ish
    camera: { make: "Apple", model: "iPhone 11" },
  },
  {
    ts: 1623542400, // 2021-06-13 00:00 UTC
    caption: "Coffee. Just coffee.",
    mediaCount: 1,
    yearMonthFolder: "202106",
    baseId: "AABB0012",
    location: { lat: 47.6062, lon: -122.3321 }, // Seattle
    camera: { make: "Apple", model: "iPhone 12" },
  },
  {
    ts: 1640995200, // 2022-01-01 00:00 UTC
    caption: "1/1/22. ItÌ¶'s gonna be a year. ðŸŽ‡",
    mediaCount: 3,
    yearMonthFolder: "202201",
    baseId: "AABB0013",
    location: { lat: 50.0755, lon: 14.4378 }, // Prague
    camera: { make: "Apple", model: "iPhone 13" },
    comments: [
      { text: "happy new year!!!", author: "alex_p", offsetSec: 30 },
      { text: "let's get coffee soon ðŸ™Œ", author: "anna_b", offsetSec: 90 },
    ],
  },
  {
    ts: 1664582400, // 2022-10-01 00:00 UTC
    caption: "She finally got the puppy. Family is happy.",
    mediaCount: 2,
    yearMonthFolder: "202210",
    baseId: "AABB0014",
    location: { lat: 40.4168, lon: -3.7038 }, // Madrid
    camera: { make: "Fujifilm", model: "X-T4" },
  },
  {
    ts: 1689811200, // 2023-07-20 00:00 UTC
    caption: "",
    mediaCount: 1,
    yearMonthFolder: "202307",
    baseId: "AABB0015",
    camera: { make: "Apple", model: "iPhone 14 Pro" },
  },
  {
    ts: 1700055600, // 2023-11-15 13:40 UTC
    caption: "Three views from the same morning",
    mediaCount: 3,
    yearMonthFolder: "202311",
    baseId: "AABB0016",
    location: { lat: 59.9139, lon: 10.7522 }, // Oslo
    camera: { make: "Fujifilm", model: "X-T4" },
    comments: [{ text: "these are great!", author: "friend1", offsetSec: 400 }],
  },
  {
    ts: 1715342400, // 2024-05-10 12:00 UTC
    caption: "Ten years on this account. WildðŸ¥¹",
    mediaCount: 1,
    yearMonthFolder: "202405",
    baseId: "AABB0017",
    location: { lat: 41.4036, lon: 2.1744 }, // Barcelona (same as first post)
    camera: { make: "Apple", model: "iPhone 15 Pro" },
    comments: [
      { text: "I remember your first post!! ðŸ¥¹", author: "old_friend_99", offsetSec: 1800 },
    ],
  },
  {
    ts: 1733011200, // 2024-12-01 00:00 UTC
    caption: "No caption needed.",
    mediaCount: 1,
    yearMonthFolder: "202412",
    baseId: "AABB0018",
    camera: { make: "Apple", model: "iPhone 15 Pro" },
  },
];

interface RawMetaMediaFixture {
  uri: string;
  creation_timestamp: number;
  media_metadata?: {
    photo_metadata: {
      exif_data: Array<{
        latitude?: number;
        longitude?: number;
        camera_make?: string;
        camera_model?: string;
      }>;
    };
  };
}

interface RawMetaPostFixture {
  creation_timestamp: number;
  title: string;
  media: RawMetaMediaFixture[];
}

interface RawCommentFixture {
  string_map_data: {
    Comment: { value: string; timestamp: number };
    Time: { timestamp: number };
  };
  title: string;
  media_list_data: Array<{ uri: string }>;
}

function buildRawData(): { posts: RawMetaPostFixture[]; comments: { comments: RawCommentFixture[] } } {
  const posts: RawMetaPostFixture[] = [];
  const allComments: RawCommentFixture[] = [];

  for (const p of DEMO_POSTS) {
    const media: RawMetaMediaFixture[] = [];
    for (let i = 0; i < p.mediaCount; i++) {
      const exif: { latitude?: number; longitude?: number; camera_make?: string; camera_model?: string } = {};
      if (p.location) {
        exif.latitude = p.location.lat;
        exif.longitude = p.location.lon;
      }
      if (p.camera) {
        exif.camera_make = p.camera.make;
        exif.camera_model = p.camera.model;
      }
      const m: RawMetaMediaFixture = {
        uri: `media/posts/${p.yearMonthFolder}/${p.baseId}_${i}.jpg`,
        creation_timestamp: p.ts + i * 60,
      };
      if (Object.keys(exif).length > 0) {
        m.media_metadata = { photo_metadata: { exif_data: [exif] } };
      }
      media.push(m);
    }
    posts.push({ creation_timestamp: p.ts, title: p.caption, media });

    if (p.comments) {
      for (const c of p.comments) {
        allComments.push({
          string_map_data: {
            Comment: { value: c.text, timestamp: p.ts + c.offsetSec },
            Time: { timestamp: p.ts + c.offsetSec },
          },
          title: c.author,
          media_list_data: [{ uri: media[0]!.uri }],
        });
      }
    }
  }

  return { posts, comments: { comments: allComments } };
}

async function main(): Promise<void> {
  const { posts, comments } = buildRawData();
  const zip = new yazl.ZipFile();

  zip.addBuffer(Buffer.from(JSON.stringify(posts, null, 2)), "content/posts_1.json");
  zip.addBuffer(
    Buffer.from(JSON.stringify(comments, null, 2)),
    "comments/post_comments_1.json",
  );
  zip.addBuffer(
    Buffer.from(JSON.stringify({ account_information: { username: "demo_user", emails: [] } }, null, 2)),
    "personal_information/account_information.json",
  );

  for (const p of posts) {
    for (const m of p.media) {
      zip.addBuffer(PLACEHOLDER_JPEG_BYTES, m.uri);
    }
  }

  zip.end();

  await fs.mkdir(path.dirname(DEMO_ZIP), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(DEMO_ZIP);
    zip.outputStream.pipe(out).on("close", () => resolve()).on("error", reject);
  });

  const totalMedia = posts.reduce((n, p) => n + p.media.length, 0);
  const years = Array.from(new Set(DEMO_POSTS.map((p) => new Date(p.ts * 1000).getUTCFullYear()))).sort();
  process.stdout.write(`Wrote ${DEMO_ZIP}\n`);
  process.stdout.write(
    `  ${posts.length} posts, ${totalMedia} media, ${comments.comments.length} comments\n`,
  );
  process.stdout.write(`  years: ${years.join(", ")}\n`);
}

main().catch((err) => {
  process.stderr.write(`demo build failed: ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
