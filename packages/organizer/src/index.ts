/**
 * @antigram/organizer — write a parsed Post's media + sidecar JSON to the
 * output folder using the layout documented in {@link ./paths.ts}.
 *
 * The metadata writer is optional and injected — the organizer doesn't know
 * about exiftool directly. This keeps the package easy to unit-test (no
 * binary daemons) and lets callers choose whether to embed EXIF or just
 * dump files + sidecars.
 */

import { promises as fsp, type WriteStream } from "node:fs";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type {
  ArchiveInfo,
  Media,
  Post,
  PostMetadataSidecar,
} from "@antigram/types";
import {
  archiveInfoPath,
  bucketForPost,
  mediaOutputLayout,
  postSidecarLayout,
} from "./paths.js";

export {
  archiveInfoPath,
  bucketForMedia,
  bucketForPost,
  mediaOutputLayout,
  postSidecarLayout,
  shortPostHash,
} from "./paths.js";

/**
 * A media source the organizer can stream bytes from. ZipHandle from
 * @antigram/parser satisfies this contract via openEntryStream(name).
 */
export interface MediaSource {
  openEntryStream(uri: string): Promise<NodeJS.ReadableStream>;
}

/**
 * The exiftool writer is contracted via interface (not the concrete class)
 * so tests can inject a no-op.
 */
export interface MetadataEmbedder {
  writeForMedia(outputPath: string, media: Media, postCaption: string): Promise<void>;
}

export interface OrganizePostOptions {
  /** Absolute path of the root folder to write into. */
  outputRoot: string;
  /** Where to stream media bytes from. */
  source: MediaSource;
  /** Optional: embed EXIF/XMP after the bytes land. */
  metadata?: MetadataEmbedder;
  /** Per-media progress callback. */
  onMediaWritten?: (event: { post: Post; media: Media; absPath: string }) => void;
}

export interface OrganizePostResult {
  /** Absolute paths of media files written. */
  mediaPaths: string[];
  /** Absolute path of the sidecar JSON. */
  sidecarPath: string;
  /** Per-media warnings (e.g., metadata write failure). */
  warnings: string[];
}

const ANTIGRAM_VERSION = "0.1.0-dev";

export async function organizePost(
  post: Post,
  options: OrganizePostOptions,
): Promise<OrganizePostResult> {
  const warnings: string[] = [];
  const mediaPaths: string[] = [];
  const reclaimedAt = new Date().toISOString();

  await fsp.mkdir(path.join(options.outputRoot, bucketForPost(post)), { recursive: true });
  await fsp.mkdir(path.join(options.outputRoot, "_metadata", bucketForPost(post)), {
    recursive: true,
  });

  for (const media of post.media) {
    const layout = mediaOutputLayout(options.outputRoot, post, media);

    try {
      const inStream = await options.source.openEntryStream(media.uri);
      const outStream: WriteStream = createWriteStream(layout.absPath);
      await pipeline(inStream, outStream);
    } catch (e) {
      warnings.push(
        `Failed to write ${media.uri} → ${layout.absPath}: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    if (options.metadata && media.kind === "image") {
      try {
        await options.metadata.writeForMedia(layout.absPath, media, post.caption);
      } catch (e) {
        warnings.push(
          `Failed to embed metadata on ${layout.absPath}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    mediaPaths.push(layout.absPath);
    options.onMediaWritten?.({ post, media, absPath: layout.absPath });
  }

  const sidecar = buildSidecar(post, reclaimedAt);
  const sidecarLayout = postSidecarLayout(options.outputRoot, post);
  await fsp.writeFile(sidecarLayout.absPath, JSON.stringify(sidecar, null, 2));

  return { mediaPaths, sidecarPath: sidecarLayout.absPath, warnings };
}

export async function writeArchiveInfo(
  outputRoot: string,
  info: ArchiveInfo,
): Promise<string> {
  const p = archiveInfoPath(outputRoot);
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(info, null, 2));
  return p;
}

export function buildArchiveInfo(input: {
  zipPath: string;
  zipSha256?: string;
  exportedAt?: string;
  posts: ReadonlyArray<Post>;
}): ArchiveInfo {
  const allMedia = input.posts.flatMap((p) => p.media);
  const photoCount = allMedia.filter((m) => m.kind === "image").length;
  const videoCount = allMedia.filter((m) => m.kind === "video").length;
  const commentCount = input.posts.reduce((n, p) => n + p.comments.length, 0);

  const sortedDates = input.posts.map((p) => p.takenAt.getTime()).sort((a, b) => a - b);
  const firstDate = sortedDates[0];
  const lastDate = sortedDates.at(-1);
  const yearsCovered = Array.from(
    new Set(input.posts.map((p) => p.takenAt.getUTCFullYear())),
  ).sort((a, b) => a - b);

  return {
    antigram: { version: ANTIGRAM_VERSION, reclaimedAt: new Date().toISOString() },
    source: {
      zipPath: input.zipPath,
      ...(input.zipSha256 ? { zipSha256: input.zipSha256 } : {}),
      ...(input.exportedAt ? { exportedAt: input.exportedAt } : {}),
    },
    stats: {
      postCount: input.posts.length,
      mediaCount: allMedia.length,
      photoCount,
      videoCount,
      commentCount,
      ...(firstDate !== undefined ? { firstPostAt: new Date(firstDate).toISOString() } : {}),
      ...(lastDate !== undefined ? { lastPostAt: new Date(lastDate).toISOString() } : {}),
      yearsCovered,
    },
  };
}

function buildSidecar(post: Post, reclaimedAt: string): PostMetadataSidecar {
  return {
    id: post.id,
    caption: post.caption,
    takenAt: post.takenAt.toISOString(),
    ...(post.location ? { location: post.location } : {}),
    comments: post.comments.map((c) => ({
      text: c.text,
      ...(c.author === undefined ? {} : { author: c.author }),
      ...(c.at === undefined ? {} : { at: c.at.toISOString() }),
    })),
    ...(post.likeCount === undefined ? {} : { likeCount: post.likeCount }),
    ...(post.crossPostSource ? { crossPostSource: post.crossPostSource } : {}),
    media: post.media.map((m) => ({
      filename: mediaOutputFilename(post, m),
      kind: m.kind,
      indexInPost: m.indexInPost,
      ...(m.camera ? { camera: m.camera } : {}),
    })),
    antigram: { version: ANTIGRAM_VERSION, reclaimedAt },
  };
}

function mediaOutputFilename(post: Post, media: Media): string {
  return mediaOutputLayout("", post, media).filename;
}
