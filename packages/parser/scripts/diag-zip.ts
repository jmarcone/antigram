/**
 * Tightest possible repro: open the user's ZIP via our ZipHandle and try
 * to read the comments entry into a buffer. Lots of explicit event
 * logging so we can see exactly where the silent failure is.
 */

import { openExportZip } from "../src/zip.js";

async function main(): Promise<void> {
  const zipPath = process.argv[2];
  if (!zipPath) {
    process.stderr.write("usage: tsx diag-zip.ts <zip>\n");
    process.exit(2);
  }

  process.stderr.write(`opening ${zipPath}\n`);
  const t0 = Date.now();
  const handle = await openExportZip(zipPath);
  process.stderr.write(`opened in ${Date.now() - t0} ms; ${handle.entries.size} entries\n`);

  // Find the entry we keep tripping on
  const target = [...handle.entries.keys()].find((n) =>
    n.endsWith("post_comments_1.json"),
  );
  if (!target) throw new Error("no comments entry");
  process.stderr.write(`target: ${target}\n`);

  process.stderr.write("calling readEntryBuffer...\n");
  const t1 = Date.now();
  try {
    const buf = await handle.readEntryBuffer(target);
    process.stderr.write(
      `readEntryBuffer ok in ${Date.now() - t1} ms; ${buf.length} bytes\n`,
    );
  } catch (e) {
    process.stderr.write(
      `readEntryBuffer threw: ${e instanceof Error ? e.stack : e}\n`,
    );
    throw e;
  }

  await handle.close();
  process.stderr.write("done.\n");
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
