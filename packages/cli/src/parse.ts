/**
 * `antigram parse <zip>` — discover and parse a Meta export, print stats.
 *
 * This is the sanity-check command for users who just received their Meta
 * export and want to confirm Antigram can read it before processing.
 */

import { discoverExport, parseExport } from "@antigram/parser";

function printSummary(label: string, value: number | string): void {
  process.stdout.write(`  ${label.padEnd(22)} ${String(value)}\n`);
}

export async function runParse(args: string[]): Promise<void> {
  const zipPath = args[0];
  if (!zipPath) {
    process.stderr.write("usage: antigram parse <path-to-export.zip>\n");
    process.exit(2);
  }

  const t0 = Date.now();
  process.stderr.write(`[antigram] parse ${zipPath}\n`);

  const discovery = await discoverExport(zipPath);
  const tDiscover = Date.now();
  process.stdout.write("\nDiscovery\n");
  printSummary("posts JSON files:", discovery.postsJsonPaths.length);
  printSummary("comments JSON files:", discovery.commentsJsonPaths.length);
  printSummary("media entries in ZIP:", discovery.mediaEntryCount);
  printSummary("export version guess:", discovery.exportVersionGuess ?? "(unknown)");
  printSummary("discovery time:", `${tDiscover - t0} ms`);

  const result = await parseExport(zipPath, {});
  const tParse = Date.now();

  const photos = result.posts.reduce(
    (n, p) => n + p.media.filter((m) => m.kind === "image").length,
    0,
  );
  const videos = result.posts.reduce(
    (n, p) => n + p.media.filter((m) => m.kind === "video").length,
    0,
  );
  const comments = result.posts.reduce((n, p) => n + p.comments.length, 0);
  const dates = result.posts.map((p) => p.takenAt.getTime()).sort((a, b) => a - b);
  const firstDate = dates[0];
  const lastDate = dates.at(-1);

  process.stdout.write("\nParse\n");
  printSummary("posts parsed:", result.posts.length);
  printSummary("photos:", photos);
  printSummary("videos:", videos);
  printSummary("comments:", comments);
  printSummary(
    "first post:",
    firstDate !== undefined ? new Date(firstDate).toISOString().slice(0, 10) : "—",
  );
  printSummary(
    "last post:",
    lastDate !== undefined ? new Date(lastDate).toISOString().slice(0, 10) : "—",
  );
  printSummary("parse time:", `${tParse - tDiscover} ms`);

  if (result.warnings.length > 0) {
    process.stdout.write(`\n${result.warnings.length} warning(s)\n`);
    for (const w of result.warnings.slice(0, 10)) {
      process.stdout.write(`  - ${w}\n`);
    }
    if (result.warnings.length > 10) {
      process.stdout.write(`  ... and ${result.warnings.length - 10} more\n`);
    }
  }

  process.stdout.write("\nDone.\n");
}
