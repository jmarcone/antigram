/**
 * Parse Meta's comments JSON files and group by the media URI they reference.
 *
 * The comments file schema varies by export version. The common 2024+ shape
 * looks roughly like:
 *
 *   [{
 *     "string_map_data": {
 *       "Comment": { "value": "...", "timestamp": 1670000000 },
 *       "Media Owner": { "value": "myhandle" },
 *       "Time": { "timestamp": 1670000000 }
 *     },
 *     "media_list_data": [{ "uri": "media/posts/202301/foo.jpg" }],
 *     "title": "<commenter handle>"
 *   }, ...]
 *
 * Older exports use a flatter structure. We attempt to extract: comment text,
 * author handle, timestamp, and the media URI(s) being commented on. Then we
 * group by URI so the parser can attach comments to the right post.
 */

import type { Comment, RawMetaComment } from "@antigram/types";
import { fixMojibake } from "./mojibake.js";

export interface CommentsByMediaUri {
  /** Comments indexed by the media URI they reference. */
  byUri: Map<string, Comment[]>;
  /** Comments that couldn't be associated with a known URI. */
  orphans: Comment[];
}

interface ParsedCommentRow {
  text: string;
  author?: string;
  at?: Date;
  mediaUris: string[];
}

export function parseCommentsBuffer(buf: Buffer, sourceLabel: string): CommentsByMediaUri {
  const raw = parseJsonLoose(buf, sourceLabel);
  const rows = extractRows(raw);

  const result: CommentsByMediaUri = { byUri: new Map(), orphans: [] };

  for (const row of rows) {
    const text = fixMojibake(row.text);
    const author = row.author === undefined ? undefined : fixMojibake(row.author);
    const comment: Comment = {
      text,
      ...(author === undefined ? {} : { author }),
      ...(row.at === undefined ? {} : { at: row.at }),
    };

    if (row.mediaUris.length === 0) {
      result.orphans.push(comment);
      continue;
    }
    for (const uri of row.mediaUris) {
      const list = result.byUri.get(uri);
      if (list) list.push(comment);
      else result.byUri.set(uri, [comment]);
    }
  }

  return result;
}

/** Tolerant JSON parser: accepts either a top-level array or an object with a `comments` key. */
function parseJsonLoose(buf: Buffer, sourceLabel: string): unknown {
  const text = buf.toString("utf8");
  try {
    return JSON.parse(text);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to parse comments JSON ${sourceLabel}: ${reason}`);
  }
}

function extractRows(raw: unknown): ParsedCommentRow[] {
  const list = pickList(raw);
  const out: ParsedCommentRow[] = [];
  for (const row of list) {
    if (!isObject(row)) continue;
    const parsed = parseRow(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

function pickList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (isObject(raw)) {
    for (const key of ["comments", "comments_media_comments", "post_comments"]) {
      const v = raw[key];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function parseRow(row: Record<string, unknown>): ParsedCommentRow | null {
  const raw = row as unknown as RawMetaComment;
  const stringMap = raw.string_map_data ?? {};

  const text = stringMap.Comment?.value;
  if (typeof text !== "string" || text.length === 0) return null;

  const author =
    (typeof raw.title === "string" && raw.title) ||
    (typeof stringMap.Owner?.value === "string" && stringMap.Owner.value) ||
    undefined;

  const tsCandidate =
    stringMap.Time?.timestamp ?? stringMap.Comment?.timestamp ?? undefined;
  const at = typeof tsCandidate === "number" ? new Date(tsCandidate * 1000) : undefined;

  const mediaUris: string[] = [];
  if (Array.isArray(raw.media_list_data)) {
    for (const m of raw.media_list_data) {
      if (m && typeof m.uri === "string" && m.uri.length > 0) mediaUris.push(m.uri);
    }
  }

  return {
    text,
    ...(author ? { author } : {}),
    ...(at ? { at } : {}),
    mediaUris,
  };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
