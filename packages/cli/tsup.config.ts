import { defineConfig } from "tsup";

export default defineConfig({
  entry: { sidecar: "src/sidecar.ts" },
  format: ["cjs"],
  outDir: "dist",
  target: "node20",
  platform: "node",
  bundle: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  noExternal: [
    "@antigram/types",
    "@antigram/parser",
    "@antigram/metadata",
    "@antigram/organizer",
    "yauzl",
    "buffer-crc32",
    "fd-slicer",
    "pend",
  ],
  // exiftool-vendored loads platform-specific binaries from sibling packages
  // at runtime; bundling would break that resolution.
  external: ["exiftool-vendored"],
});
