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

import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const DIST_DIR = path.resolve(__dirname, "..", "dist");
const STAGE_DIR = path.join(DIST_DIR, "exiftool");

// exiftool-vendored declares the platform binary as an optionalDependency.
// In pnpm strict mode (our setup) it ends up at `.pnpm/.../node_modules/
// exiftool-vendored.<plat>` next to `.pnpm/.../node_modules/exiftool-vendored`,
// but NOT in our package's direct node_modules. We can't `require.resolve`
// it from here — instead we resolve exiftool-vendored's own package.json
// (which we *do* have access to), follow the symlink, and look for the
// platform sibling in the same flat node_modules dir.
const PLATFORM_BINARY_PACKAGE: Partial<Record<NodeJS.Platform, string>> = {
  win32: "exiftool-vendored.exe",
  darwin: "exiftool-vendored.pl",
  linux: "exiftool-vendored.pl",
};

function locatePlatformBinaryRuntimeDir(pkgName: string): string | null {
  // 1. exiftool-vendored is one of our direct deps so this resolves cleanly.
  const exifVendoredPkgJson = require.resolve("exiftool-vendored/package.json");
  // 2. Follow the pnpm symlink to the real on-disk location.
  const realExifVendoredPkgDir = path.dirname(realpathSync(exifVendoredPkgJson));
  // 3. Sibling subpackages of exiftool-vendored share its flat node_modules.
  const flatNodeModules = path.dirname(realExifVendoredPkgDir);
  // 4. The runtime files live under the sibling package's `bin/` subdir.
  const candidate = path.join(flatNodeModules, pkgName, "bin");
  return existsSync(candidate) ? candidate : null;
}

function main(): void {
  if (!existsSync(DIST_DIR)) {
    throw new Error(
      `stage-bundle: dist/ not found at ${DIST_DIR}. Run tsup first (this script is a post-build step).`,
    );
  }

  const pkgName = PLATFORM_BINARY_PACKAGE[process.platform];
  if (!pkgName) {
    process.stdout.write(
      `[stage-bundle] no exiftool spec for platform '${process.platform}'; skipping copy.\n`,
    );
    return;
  }

  const srcSubdir = locatePlatformBinaryRuntimeDir(pkgName);
  if (!srcSubdir) {
    throw new Error(
      `stage-bundle: could not locate ${pkgName}/bin. Is exiftool-vendored installed for this platform?`,
    );
  }

  rmSync(STAGE_DIR, { recursive: true, force: true });
  mkdirSync(STAGE_DIR, { recursive: true });
  cpSync(srcSubdir, STAGE_DIR, { recursive: true, dereference: true });

  process.stdout.write(`[stage-bundle] staged ${pkgName}/bin → ${STAGE_DIR}\n`);
}

main();
