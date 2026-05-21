/**
 * Walks the ZIP's entry list and classifies what's inside.
 *
 * Meta restructures their export folder layout periodically. Rather than
 * pinning to one layout, we search by filename pattern wherever it lives:
 *
 *   posts_*.json            — wall posts (the main thing we want)
 *   stories_*.json          — Stories archive (Phase 4)
 *   reels_*.json            — Reels (Phase 4)
 *   archived_posts_*.json   — archived feed posts
 *   post_comments_*.json    — comments on the user's own posts
 *   reels_comments_*.json   — comments on the user's reels
 *
 *   media/posts/YYYYMM/...  — the actual photo & video files
 */

import { openExportZip, type ZipHandle } from "./zip.js";

const POSTS_PATTERNS = [/(^|\/)posts_\d+\.json$/i, /(^|\/)posts\.json$/i];

const COMMENTS_PATTERNS = [
  /(^|\/)post_comments_\d+\.json$/i,
  /(^|\/)post_comments\.json$/i,
  /(^|\/)comments_\d+\.json$/i,
];

const MEDIA_EXT = /\.(jpe?g|png|heic|webp|mp4|mov|webm)$/i;

const ACCOUNT_INFO_PATTERNS = [
  /(^|\/)account_information\.json$/i,
  /(^|\/)personal_information\.json$/i,
];

export interface ExportDiscovery {
  zip: ZipHandle;
  postsJsonPaths: string[];
  commentsJsonPaths: string[];
  mediaEntryCount: number;
  /** Heuristic — null if we can't guess. */
  exportVersionGuess: string | null;
  accountInfoPath: string | null;
}

/**
 * Open the ZIP, enumerate, classify. Caller is responsible for calling
 * `result.zip.close()` when done (or use `parseExport` which handles it).
 */
export async function discoverExport(zipPath: string): Promise<ExportDiscovery> {
  const zip = await openExportZip(zipPath);
  const names = zip.listNames();

  const postsJsonPaths: string[] = [];
  const commentsJsonPaths: string[] = [];
  let mediaEntryCount = 0;
  let accountInfoPath: string | null = null;

  for (const name of names) {
    if (matchesAny(name, POSTS_PATTERNS)) postsJsonPaths.push(name);
    else if (matchesAny(name, COMMENTS_PATTERNS)) commentsJsonPaths.push(name);
    else if (MEDIA_EXT.test(name) && name.includes("/media/")) mediaEntryCount += 1;
    else if (MEDIA_EXT.test(name) && name.startsWith("media/")) mediaEntryCount += 1;

    if (!accountInfoPath && matchesAny(name, ACCOUNT_INFO_PATTERNS)) {
      accountInfoPath = name;
    }
  }

  postsJsonPaths.sort(naturalSort);
  commentsJsonPaths.sort(naturalSort);

  return {
    zip,
    postsJsonPaths,
    commentsJsonPaths,
    mediaEntryCount,
    exportVersionGuess: guessExportVersion(names),
    accountInfoPath,
  };
}

function matchesAny(name: string, patterns: readonly RegExp[]): boolean {
  for (const re of patterns) if (re.test(name)) return true;
  return false;
}

/** Sort by base filename and embedded numeric chunk (posts_2 < posts_10). */
function naturalSort(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const aParts = a.match(re) ?? [a];
  const bParts = b.match(re) ?? [b];
  const len = Math.min(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const av = aParts[i] ?? "";
    const bv = bParts[i] ?? "";
    const aNum = Number(av);
    const bNum = Number(bv);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else if (av !== bv) {
      return av < bv ? -1 : 1;
    }
  }
  return aParts.length - bParts.length;
}

function guessExportVersion(names: readonly string[]): string | null {
  // 2024+ exports nest under "your_instagram_activity/".
  if (names.some((n) => n.startsWith("your_instagram_activity/"))) return "2024+";
  // Pre-2024 had a flat layout.
  if (names.some((n) => /^content\/posts_\d+\.json$/i.test(n))) return "pre-2024";
  return null;
}
