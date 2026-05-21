#!/usr/bin/env node
/**
 * NDJSON-event entrypoint for the Tauri sidecar.
 *
 * Tauri's Rust side spawns this with `node antigram-pipeline.cjs <command>
 * <args...>` and reads stdout line by line. Each line is a JSON envelope.
 *
 * Two commands:
 *
 *   parse <zip>
 *     Emits "discovery", "parsed" with posts (serialized JSON), and
 *     "warnings". Then exits 0.
 *
 *   reclaim <zip> <out> [--post-id <id>] ...
 *     Streams the full pipeline. Emits a steady stream of "post_start",
 *     "media_written", "post_done" events and a final "done" envelope.
 *
 * All envelopes have the shape `{ "k": "<kind>", ... }`. Errors emit `{
 * "k": "error", "message": "..." }` then the process exits non-zero.
 */

import path from "node:path";
import { existsSync, promises as fsp } from "node:fs";
import { parseExport } from "@antigram/parser";
import { MetadataWriter } from "@antigram/metadata";
import {
  buildArchiveInfo,
  organizePost,
  writeArchiveInfo,
  type MediaSource,
} from "@antigram/organizer";
import type { Post } from "@antigram/types";

type Envelope =
  | { k: "discovery"; postsJsonCount: number; mediaCount: number; exportVersion: string | null }
  | { k: "parsed"; posts: SerializedPost[]; warnings: string[] }
  | { k: "reclaim_start"; total: number }
  | { k: "post_start"; postId: string; index: number; total: number }
  | { k: "media_written"; postId: string; absPath: string }
  | { k: "post_done"; postId: string; index: number; total: number }
  | { k: "done"; outputRoot: string; mediaWritten: number; warnings: string[] }
  | { k: "error"; message: string };

interface SerializedPost {
  id: string;
  caption: string;
  takenAt: string;
  takenYear: number;
  takenMonth: number;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  comments: Array<{ text: string; author?: string; at?: string }>;
  likeCount?: number;
  crossPostSource?: string;
  media: Array<{
    uri: string;
    filename: string;
    kind: string;
    indexInPost: number;
    postMediaCount: number;
  }>;
}

function emit(env: Envelope): void {
  process.stdout.write(`${JSON.stringify(env)}\n`);
}

function serializePost(p: Post): SerializedPost {
  return {
    id: p.id,
    caption: p.caption,
    takenAt: p.takenAt.toISOString(),
    takenYear: p.takenAt.getUTCFullYear(),
    takenMonth: p.takenAt.getUTCMonth() + 1,
    ...(p.location ? { location: p.location } : {}),
    comments: p.comments.map((c) => ({
      text: c.text,
      ...(c.author === undefined ? {} : { author: c.author }),
      ...(c.at === undefined ? {} : { at: c.at.toISOString() }),
    })),
    ...(p.likeCount === undefined ? {} : { likeCount: p.likeCount }),
    ...(p.crossPostSource ? { crossPostSource: p.crossPostSource } : {}),
    media: p.media.map((m) => ({
      uri: m.uri,
      filename: m.filename,
      kind: m.kind,
      indexInPost: m.indexInPost,
      postMediaCount: m.postMediaCount,
    })),
  };
}

async function runParseCommand(zipPath: string): Promise<void> {
  const { posts, warnings, discovery } = await parseExport(zipPath);
  emit({
    k: "discovery",
    postsJsonCount: discovery.postsJsonPaths.length,
    mediaCount: discovery.mediaEntryCount,
    exportVersion: discovery.exportVersionGuess,
  });
  emit({ k: "parsed", posts: posts.map(serializePost), warnings });
}

async function runReclaimCommand(
  zipPath: string,
  outputRoot: string,
  filterIds: ReadonlySet<string> | null,
): Promise<void> {
  const absOut = path.resolve(outputRoot);
  await fsp.mkdir(absOut, { recursive: true });

  const { posts, warnings, discovery } = await parseExport(zipPath, { keepOpen: true });
  const selected = filterIds ? posts.filter((p) => filterIds.has(p.id)) : posts;
  const allWarnings = [...warnings];
  let mediaWritten = 0;

  emit({ k: "reclaim_start", total: selected.length });

  // In production .msi builds the sidecar is bundled with a sibling
  // exiftool.exe; let MetadataWriter use that instead of trying to
  // resolve exiftool-vendored from node_modules (which the .msi doesn't
  // ship). Dev/CLI runs fall through to exiftool-vendored's default.
  const exiftoolPath = findBundledExiftool();
  const writer = new MetadataWriter(exiftoolPath ? { exiftoolPath } : {});
  const source: MediaSource = {
    openEntryStream: (uri) => discovery.zip.openEntryStream(uri),
  };

  try {
    for (let i = 0; i < selected.length; i++) {
      const post = selected[i]!;
      emit({ k: "post_start", postId: post.id, index: i, total: selected.length });
      const result = await organizePost(post, {
        outputRoot: absOut,
        source,
        metadata: writer,
        onMediaWritten: ({ absPath }) => {
          emit({ k: "media_written", postId: post.id, absPath });
        },
      });
      mediaWritten += result.mediaPaths.length;
      allWarnings.push(...result.warnings);
      emit({ k: "post_done", postId: post.id, index: i, total: selected.length });
    }

    const info = buildArchiveInfo({ zipPath, posts: selected });
    await writeArchiveInfo(absOut, info);
  } finally {
    await writer.close();
    await discovery.zip.close();
  }

  emit({ k: "done", outputRoot: absOut, mediaWritten, warnings: allWarnings });
}

function findBundledExiftool(): string | undefined {
  // The post-tsup stage-bundle step copies the ExifTool runtime to
  // `<sidecar-dir>/exiftool/`. In dev (tsx of source) that folder doesn't
  // exist, so we fall through to exiftool-vendored's default lookup.
  // The sidecar always ships as CJS, so __filename is reliably defined.
  const dir = path.dirname(__filename);
  const candidates = [
    path.join(dir, "exiftool", "exiftool.exe"),
    path.join(dir, "exiftool", "exiftool"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

function parseFilterIds(args: readonly string[]): Set<string> | null {
  const ids: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--post-id" && args[i + 1]) {
      ids.push(args[i + 1] as string);
      i++;
    }
  }
  return ids.length === 0 ? null : new Set(ids);
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  try {
    switch (cmd) {
      case "parse": {
        const zipPath = rest[0];
        if (!zipPath) throw new Error("sidecar parse: missing zip path");
        await runParseCommand(zipPath);
        return;
      }
      case "reclaim": {
        const zipPath = rest[0];
        const outputRoot = rest[1];
        if (!zipPath || !outputRoot) {
          throw new Error("sidecar reclaim: missing zip path or output root");
        }
        const filter = parseFilterIds(rest.slice(2));
        await runReclaimCommand(zipPath, outputRoot, filter);
        return;
      }
      default:
        throw new Error(`sidecar: unknown command '${cmd}'`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ k: "error", message });
    await flushStdout();
    process.exit(1);
  }
}

/**
 * Drain process.stdout before letting the process exit. The `parsed`
 * envelope for a large archive is multi-MB of JSON in a single line, and
 * Node may not finish flushing it to the pipe before the event loop ends
 * — which leaves the Rust side waiting for a newline that never comes,
 * and silently returning `posts: null` to the React app. An explicit
 * drain fixes it.
 */
function flushStdout(): Promise<void> {
  return new Promise<void>((resolve) => {
    // process.stdout.write('', cb) fires cb only once everything queued
    // before it has been processed.
    process.stdout.write("", () => resolve());
  });
}

main().then(flushStdout);
