/**
 * Step-by-step parse diagnostic. Times each phase of parseExport against
 * a real Meta export so we can see where time actually goes.
 */

import { discoverExport } from "../src/discover.js";
import { parseCommentsBuffer } from "../src/comments.js";
import { normalizePost } from "../src/normalize.js";

async function main(): Promise<void> {
  const zipPath = process.argv[2];
  if (!zipPath) {
    process.stderr.write("usage: tsx diag-parse.ts <zip>\n");
    process.exit(2);
  }

  let t = Date.now();
  const stamp = (label: string): void => {
    const now = Date.now();
    process.stderr.write(`  ${label.padEnd(36)} ${now - t} ms\n`);
    t = now;
  };

  process.stderr.write("Discovery:\n");
  const discovery = await discoverExport(zipPath);
  stamp("discoverExport()");
  process.stderr.write(`  posts:    ${discovery.postsJsonPaths.length}\n`);
  process.stderr.write(`  comments: ${discovery.commentsJsonPaths.length}\n`);
  process.stderr.write(`  media:    ${discovery.mediaEntryCount}\n\n`);

  process.stderr.write("Comments:\n");
  const commentsByUri = new Map<string, Array<{ text: string; author?: string; at?: Date }>>();
  for (const p of discovery.commentsJsonPaths) {
    process.stderr.write(`  reading ${p}\n`);
    const buf = await discovery.zip.readEntryBuffer(p);
    stamp("    readEntryBuffer");
    const { byUri, orphans } = parseCommentsBuffer(buf, p);
    stamp("    parseCommentsBuffer");
    process.stderr.write(`    byUri keys: ${byUri.size}, orphans: ${orphans.length}\n`);
    for (const [uri, list] of byUri) commentsByUri.set(uri, list);
  }

  process.stderr.write("\nPosts:\n");
  for (const p of discovery.postsJsonPaths) {
    process.stderr.write(`  reading ${p}\n`);
    const buf = await discovery.zip.readEntryBuffer(p);
    stamp("    readEntryBuffer");
    process.stderr.write(`    buf size: ${(buf.length / 1024 / 1024).toFixed(2)} MB\n`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(buf.toString("utf8"));
    } catch (e) {
      process.stderr.write(`    JSON.parse failed: ${(e as Error).message}\n`);
      continue;
    }
    stamp("    JSON.parse");

    const arr = Array.isArray(parsed)
      ? parsed
      : (typeof parsed === "object" &&
          parsed !== null &&
          (parsed as Record<string, unknown>).posts) ||
        [];
    if (!Array.isArray(arr)) {
      process.stderr.write("    not a recognizable posts array; sample keys:\n");
      if (parsed && typeof parsed === "object") {
        process.stderr.write(`      ${Object.keys(parsed as object).slice(0, 10).join(", ")}\n`);
      }
      continue;
    }
    process.stderr.write(`    posts rows: ${arr.length}\n`);

    let normalized = 0;
    let skipped = 0;
    let chunkNumMatch = /posts_(\d+)\.json$/i.exec(p);
    const chunk = chunkNumMatch?.[1] ? parseInt(chunkNumMatch[1], 10) : 0;
    for (let i = 0; i < arr.length; i++) {
      const row = arr[i];
      if (!row || typeof row !== "object" || !Array.isArray((row as { media?: unknown }).media)) {
        skipped++;
        continue;
      }
      const post = normalizePost(row as never, {
        postIndex: i,
        postsFileChunk: chunk,
        commentsByUri,
      });
      if (post) normalized++;
      else skipped++;
    }
    stamp("    normalize all");
    process.stderr.write(`    normalized: ${normalized}, skipped: ${skipped}\n`);
  }

  await discovery.zip.close();
  process.stderr.write("\ndone.\n");
}

main().catch((err) => {
  process.stderr.write(`fatal: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
