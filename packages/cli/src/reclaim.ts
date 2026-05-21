/**
 * `antigram reclaim <zip> <output>` — full end-to-end pipeline.
 *
 *   parse → organize each post (stream media from ZIP) → write EXIF/XMP
 *   → write sidecar JSON → write _archive_info.json
 *
 * Designed to be safe to interrupt: the source ZIP is never modified, and
 * partial output (a few files in YYYY-MM/) is still useful. Re-running
 * overwrites — same post + same media URI → same destination filename.
 */

import path from "node:path";
import { promises as fsp } from "node:fs";
import { parseExport } from "@antigram/parser";
import { MetadataWriter } from "@antigram/metadata";
import {
  buildArchiveInfo,
  organizePost,
  writeArchiveInfo,
  type MediaSource,
} from "@antigram/organizer";

export interface ReclaimOptions {
  /** Skip EXIF embedding. Useful for quick sanity runs. */
  skipMetadata?: boolean;
  /** Limit to the first N posts (for smoke tests). */
  limit?: number;
}

export async function runReclaim(args: string[]): Promise<void> {
  const zipPath = args[0];
  const outRoot = args[1];
  if (!zipPath || !outRoot) {
    process.stderr.write("usage: antigram reclaim <path-to-export.zip> <output-folder>\n");
    process.exit(2);
  }
  const skipMetadata = args.includes("--no-metadata");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : undefined;
  await reclaim(zipPath, outRoot, { skipMetadata, ...(limit ? { limit } : {}) });
}

export async function reclaim(
  zipPath: string,
  outRoot: string,
  options: ReclaimOptions = {},
): Promise<void> {
  const absOut = path.resolve(outRoot);
  await fsp.mkdir(absOut, { recursive: true });

  const t0 = Date.now();
  process.stderr.write(`[antigram] parsing ${zipPath}\n`);

  const { posts, warnings, discovery } = await parseExport(zipPath, { keepOpen: true });
  const selected = options.limit !== undefined ? posts.slice(0, options.limit) : posts;
  process.stderr.write(
    `[antigram] parsed ${posts.length} posts (${selected.length} selected) in ${Date.now() - t0} ms\n`,
  );

  const writer = options.skipMetadata ? null : new MetadataWriter();
  const source: MediaSource = {
    openEntryStream: (uri) => discovery.zip.openEntryStream(uri),
  };

  let mediaWritten = 0;
  const allWarnings: string[] = [...warnings];

  try {
    for (let i = 0; i < selected.length; i++) {
      const post = selected[i]!;
      const tPost = Date.now();
      const result = await organizePost(post, {
        outputRoot: absOut,
        source,
        ...(writer ? { metadata: writer } : {}),
      });
      mediaWritten += result.mediaPaths.length;
      allWarnings.push(...result.warnings);
      process.stderr.write(
        `[antigram] (${i + 1}/${selected.length}) ${post.id} → ${result.mediaPaths.length} files in ${Date.now() - tPost} ms\n`,
      );
    }

    const info = buildArchiveInfo({ zipPath, posts: selected });
    const archivePath = await writeArchiveInfo(absOut, info);
    process.stderr.write(`[antigram] wrote ${archivePath}\n`);
  } finally {
    if (writer) await writer.close();
    await discovery.zip.close();
  }

  const tTotal = Date.now() - t0;
  process.stdout.write(
    `\nReclaimed ${selected.length} posts (${mediaWritten} media) in ${tTotal} ms.\n`,
  );
  process.stdout.write(`Output folder: ${absOut}\n`);
  if (allWarnings.length > 0) {
    process.stdout.write(`\n${allWarnings.length} warning(s):\n`);
    for (const w of allWarnings.slice(0, 20)) process.stdout.write(`  - ${w}\n`);
    if (allWarnings.length > 20) process.stdout.write(`  ... and ${allWarnings.length - 20} more\n`);
  }
}
