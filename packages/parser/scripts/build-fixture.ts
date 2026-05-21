/**
 * CLI wrapper: `pnpm fixtures:build` — regenerate the synthetic test
 * fixture. The actual builder lives in test/fixture.ts so tests can call it
 * directly.
 */

import { buildFixture } from "../test/fixture.js";

async function main(): Promise<void> {
  const manifest = await buildFixture();
  process.stdout.write(`Wrote ${manifest.zipPath}\n`);
  process.stdout.write(
    `  ${manifest.postCount} posts (${manifest.rawPostCount} raw), ${manifest.mediaCount} media, ${manifest.commentCount} comments\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`fixture build failed: ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
