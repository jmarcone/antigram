/**
 * Pure path helpers for the output folder layout.
 *
 *   <out>/YYYY-MM/                                      bucket for one post's photos
 *     YYYY-MM-DD_HHMMSS_post_<short>_<i>of<n>.<ext>     reclaimed media
 *   <out>/_metadata/YYYY-MM/post_<id>.json              sidecar with full IG data
 *   <out>/_archive_info.json                            run-level stats + provenance
 *
 * The "short" component is the first 8 chars of a sha1 of the post id. Stable
 * across re-runs (the post id itself is deterministic) and unique enough to
 * disambiguate the rare case of multiple posts sharing one timestamp.
 */

import { createHash } from "node:crypto";
import path from "node:path";
import type { Media, Post } from "@antigram/types";

export interface MediaOutputLayout {
  /** Year-month bucket directory, e.g. "2016-05". Relative to outputRoot. */
  bucketDir: string;
  /** Filename within the bucket. */
  filename: string;
  /** Full relative path inside outputRoot. */
  relPath: string;
  /** Absolute path. */
  absPath: string;
}

export interface PostSidecarLayout {
  /** Relative to outputRoot, e.g. "_metadata/2016-05/post_xyz.json". */
  relPath: string;
  absPath: string;
}

export function bucketForPost(post: Post): string {
  return monthBucket(post.takenAt);
}

export function bucketForMedia(media: Media): string {
  return monthBucket(media.takenAt);
}

export function shortPostHash(postId: string): string {
  return createHash("sha1").update(postId).digest("hex").slice(0, 8);
}

export function mediaOutputLayout(
  outputRoot: string,
  post: Post,
  media: Media,
): MediaOutputLayout {
  const bucketDir = bucketForPost(post);
  const ext = extensionFor(media.filename);
  const ts = stampedFilenamePrefix(media.takenAt);
  const seq = `${media.indexInPost + 1}of${media.postMediaCount}`;
  const filename = `${ts}_post_${shortPostHash(post.id)}_${seq}.${ext}`;
  const relPath = path.posix.join(bucketDir, filename);
  return {
    bucketDir,
    filename,
    relPath,
    absPath: path.join(outputRoot, bucketDir, filename),
  };
}

export function postSidecarLayout(outputRoot: string, post: Post): PostSidecarLayout {
  const bucketDir = bucketForPost(post);
  const filename = `${post.id}.json`;
  const relPath = path.posix.join("_metadata", bucketDir, filename);
  return {
    relPath,
    absPath: path.join(outputRoot, "_metadata", bucketDir, filename),
  };
}

export function archiveInfoPath(outputRoot: string): string {
  return path.join(outputRoot, "_archive_info.json");
}

function monthBucket(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function stampedFilenamePrefix(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}${mi}${ss}`;
}

function extensionFor(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "jpg";
  const ext = filename.slice(dot + 1).toLowerCase();
  return ext.length > 0 ? ext : "jpg";
}
