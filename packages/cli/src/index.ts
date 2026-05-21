#!/usr/bin/env node
/**
 * Antigram CLI entrypoint. Dispatches to subcommand modules.
 *
 *   antigram parse   <zip>          — print stats from a Meta export ZIP
 *   antigram reclaim <zip> <out>    — full pipeline: parse → metadata → organize
 *   antigram doctor                 — environment sanity checks
 */

import { runParse } from "./parse.js";
import { runReclaim } from "./reclaim.js";

const SUBCOMMANDS = ["parse", "reclaim", "doctor"] as const;
type Sub = (typeof SUBCOMMANDS)[number];

function isSub(x: string | undefined): x is Sub {
  return typeof x === "string" && (SUBCOMMANDS as readonly string[]).includes(x);
}

function printUsage(): void {
  process.stderr.write(
    [
      "antigram — take your Instagram photos back from Meta",
      "",
      "Usage:",
      "  antigram parse   <zip>",
      "  antigram reclaim <zip> <output-folder>",
      "  antigram doctor",
      "",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const [, , sub, ...rest] = process.argv;
  if (!isSub(sub)) {
    printUsage();
    process.exit(sub ? 2 : 0);
  }

  switch (sub) {
    case "parse": {
      await runParse(rest);
      return;
    }
    case "reclaim": {
      await runReclaim(rest);
      return;
    }
    case "doctor": {
      process.stderr.write(
        `[antigram] node ${process.version} on ${process.platform}/${process.arch}\n`,
      );
      return;
    }
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[antigram] fatal: ${msg}\n`);
  process.exit(1);
});
