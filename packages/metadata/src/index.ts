/**
 * @antigram/metadata — write Antigram's normalized post info into a photo
 * file's EXIF/XMP using exiftool.
 *
 * Why exiftool-vendored: it ships per-platform exiftool binaries (Windows,
 * Mac, Linux), keeps a persistent exiftool daemon for batch performance,
 * and exposes a clean async API. Replacing it with our own bundled binary
 * is feasible later if we want smaller node_modules.
 *
 *   const writer = new MetadataWriter();
 *   try {
 *     for (const post of posts) {
 *       for (const media of post.media) {
 *         await writer.writeForMedia(outputPath, media, post.caption);
 *       }
 *     }
 *   } finally {
 *     await writer.close();
 *   }
 */

import { ExifTool, exiftool } from "exiftool-vendored";
import type { Media } from "@antigram/types";
import { buildExifTagSet } from "./exif-tags.js";

export { buildExifTagSet, formatExifDate } from "./exif-tags.js";
export type { ExifTagSet } from "./exif-tags.js";

export interface MetadataWriterOptions {
  /**
   * Inject a custom ExifTool instance (e.g. for tests). When omitted, the
   * writer either constructs its own with {@link exiftoolPath} or falls
   * back to exiftool-vendored's shared singleton.
   */
  exifTool?: ExifTool;
  /**
   * Absolute path to an exiftool binary that should be used instead of the
   * one exiftool-vendored ships. Production .msi builds set this so we use
   * the binary bundled next to the sidecar rather than the one in
   * node_modules (which doesn't exist in the .msi).
   */
  exiftoolPath?: string;
}

export class MetadataWriter {
  readonly #exifTool: ExifTool;
  readonly #ownsInstance: boolean;

  constructor(options: MetadataWriterOptions = {}) {
    if (options.exifTool) {
      this.#exifTool = options.exifTool;
      this.#ownsInstance = false;
    } else if (options.exiftoolPath) {
      this.#exifTool = new ExifTool({ exiftoolPath: options.exiftoolPath });
      this.#ownsInstance = true;
    } else {
      this.#exifTool = exiftool;
      this.#ownsInstance = true;
    }
  }

  /**
   * Write EXIF/XMP onto `outputPath` based on `media` + the post-level
   * caption. The file is updated in place; no .original sidecar is left
   * behind (we pass `-overwrite_original`).
   */
  async writeForMedia(outputPath: string, media: Media, postCaption: string): Promise<void> {
    if (media.kind === "video") {
      // Video EXIF support in exiftool exists but is patchy. Skip for the
      // alpha; sidecar JSON carries the metadata.
      return;
    }
    const { tags, extraArgs } = buildExifTagSet(media, postCaption);
    await this.#exifTool.write(outputPath, tags, { writeArgs: extraArgs });
  }

  /** Shut down the underlying exiftool daemon. Required if you used the default singleton. */
  async close(): Promise<void> {
    if (this.#ownsInstance) {
      await this.#exifTool.end();
    }
  }
}
