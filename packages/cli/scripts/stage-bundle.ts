/**
 * Post-tsup step that stages the runtime artifacts the Tauri .msi needs.
 *
 * The Windows ExifTool distribution is not a single .exe — it's a Perl
 * runtime hidden inside an exiftool_files/ sibling directory next to the
 * .exe stub. We have to copy the whole bin/ tree, not just the binary.
 *
 *   pnpm build:sidecar  →  tsup  →  this script
 *
 * Output layout under packages/cli/dist/:
 *
 *   sidecar.cjs               the bundled Node entry
 *   exiftool/exiftool.exe     the stub the Node sidecar invokes
 *   exiftool/exiftool_files/  the Perl runtime + ExifTool itself
 *
 * The Node sidecar finds exiftool/exiftool[.exe] next to itself at runtime
 * and hands the path to exiftool-vendored.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const DIST_DIR = path.resolve(__dirname, "..", "dist");
const STAGE_DIR = path.join(DIST_DIR, "exiftool");

interface PlatformSpec {
  npmPackage: string;
  subdir: "bin"; // both .exe and .pl ship their runtime under bin/
}

const PLATFORM_BINARIES: Partial<Record<NodeJS.Platform, PlatformSpec>> = {
  win32: { npmPackage: "exiftool-vendored.exe", subdir: "bin" },
  darwin: { npmPackage: "exiftool-vendored.pl", subdir: "bin" },
  linux: { npmPackage: "exiftool-vendored.pl", subdir: "bin" },
};

function main(): void {
  if (!existsSync(DIST_DIR)) {
    throw new Error(
      `stage-bundle: dist/ not found at ${DIST_DIR}. Run tsup first (this script is a post-build step).`,
    );
  }

  const spec = PLATFORM_BINARIES[process.platform];
  if (!spec) {
    process.stdout.write(
      `[stage-bundle] no exiftool spec for platform '${process.platform}'; skipping copy.\n`,
    );
    return;
  }

  let pkgMain: string;
  try {
    pkgMain = require.resolve(spec.npmPackage);
  } catch (err) {
    process.stdout.write(
      `[stage-bundle] ${spec.npmPackage} not installed (${err instanceof Error ? err.message : err}); skipping.\n`,
    );
    return;
  }

  const pkgDir = path.dirname(pkgMain);
  const srcSubdir = path.join(pkgDir, spec.subdir);
  if (!existsSync(srcSubdir)) {
    throw new Error(
      `stage-bundle: expected ${srcSubdir} to exist but it doesn't. Package layout changed?`,
    );
  }

  // Clean stage dir so we don't accumulate stale files across builds.
  rmSync(STAGE_DIR, { recursive: true, force: true });
  mkdirSync(STAGE_DIR, { recursive: true });
  cpSync(srcSubdir, STAGE_DIR, { recursive: true, dereference: true });

  process.stdout.write(`[stage-bundle] staged ${spec.npmPackage}/${spec.subdir} → ${STAGE_DIR}\n`);
}

main();
