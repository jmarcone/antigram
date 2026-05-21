/**
 * Orchestrate a full parse of a Meta export ZIP.
 *
 *   1. Discover posts / comments / media files in the archive.
 *   2. Parse each posts_*.json into typed posts.
 *   3. Parse the comments JSON files and group by media URI.
 *   4. Normalize each raw post and join comments.
 *
 * Streaming: posts_*.json files are read into memory as Buffers (one at a
 * time). Even a heavy user rarely has more than 100 MB of posts metadata.
 * Media files are *not* read here — the parser only emits URIs that the
 * pipeline opens lazily when it's time to write them out.
 */

import type { Post, RawMetaPost } from "@antigram/types";
import { discoverExport, type ExportDiscovery } from "./discover.js";
import { parseCommentsBuffer } from "./comments.js";
import { normalizePost } from "./normalize.js";

export interface ParseExportOptions {
  /**
   * If true, the ZipHandle is left open in the returned result. Caller must
   * close it. Useful when downstream code wants to stream media files out.
   * Default: false (the zip is closed before returning).
   */
  keepOpen?: boolean;
}

export interface ParseExportResult {
  posts: Post[];
  warnings: string[];
  discovery: ExportDiscovery;
}

export async function parseExport(
  zipPath: string,
  options: ParseExportOptions = {},
): Promise<ParseExportResult> {
  const discovery = await discoverExport(zipPath);
  const warnings: string[] = [];
  const posts: Post[] = [];

  try {
    const commentsByUri = await aggregateComments(discovery, warnings);

    for (const postsJsonPath of discovery.postsJsonPaths) {
      const buf = await discovery.zip.readEntryBuffer(postsJsonPath);
      const chunk = extractChunkNumber(postsJsonPath);

      let raw: unknown;
      try {
        raw = JSON.parse(buf.toString("utf8"));
      } catch (e) {
        warnings.push(
          `Could not JSON-parse ${postsJsonPath}: ${e instanceof Error ? e.message : String(e)}`,
        );
        continue;
      }

      const arr = pickPostsArray(raw);
      if (!arr) {
        warnings.push(`${postsJsonPath} did not contain a recognizable posts array`);
        continue;
      }

      arr.forEach((rawPost, postIndex) => {
        if (!isRawPost(rawPost)) {
          warnings.push(`${postsJsonPath}#${postIndex}: not a recognizable post object`);
          return;
        }
        const normalized = normalizePost(rawPost, {
          postIndex,
          postsFileChunk: chunk,
          commentsByUri,
        });
        if (normalized) posts.push(normalized);
        else warnings.push(`${postsJsonPath}#${postIndex}: skipped (no media or no timestamp)`);
      });
    }

    // Sort newest-first for UI convenience; the organizer re-sorts as needed.
    posts.sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());

    return { posts, warnings, discovery };
  } finally {
    if (!options.keepOpen) {
      await discovery.zip.close();
    }
  }
}

async function aggregateComments(
  discovery: ExportDiscovery,
  warnings: string[],
): Promise<Map<string, Array<{ text: string; author?: string; at?: Date }>>> {
  const out = new Map<string, Array<{ text: string; author?: string; at?: Date }>>();
  for (const commentsJsonPath of discovery.commentsJsonPaths) {
    try {
      const buf = await discovery.zip.readEntryBuffer(commentsJsonPath);
      const { byUri, orphans } = parseCommentsBuffer(buf, commentsJsonPath);
      for (const [uri, comments] of byUri) {
        const merged = out.get(uri);
        if (merged) merged.push(...comments);
        else out.set(uri, [...comments]);
      }
      if (orphans.length > 0) {
        warnings.push(`${commentsJsonPath}: ${orphans.length} comment(s) without a media URI`);
      }
    } catch (e) {
      warnings.push(
        `Could not parse ${commentsJsonPath}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return out;
}

function pickPostsArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && raw !== null) {
    const candidates = ["posts", "items", "data"] as const;
    for (const k of candidates) {
      const v = (raw as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

function isRawPost(x: unknown): x is RawMetaPost {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as Record<string, unknown>;
  return Array.isArray(obj.media);
}

function extractChunkNumber(path: string): number {
  const match = /posts_(\d+)\.json$/i.exec(path);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}
