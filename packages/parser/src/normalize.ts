/**
 * Convert Meta's raw post shape into Antigram's normalized {@link Post}.
 *
 *   - de-mojibake captions and place names
 *   - lift first usable lat/lon into a Location object
 *   - synthesize a stable post id (post_<base36-ts>_<index>)
 *   - synthesize a basename for each media (uri's last path segment)
 *   - classify each media as image / video / unknown by extension
 *   - keep the original media URI so the pipeline can read it from the ZIP
 */

import type {
  CameraInfo,
  Location,
  Media,
  MediaKind,
  Post,
  RawMetaExifEntry,
  RawMetaMedia,
  RawMetaPost,
} from "@antigram/types";
import { fixMojibake } from "./mojibake.js";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "heic", "webp", "gif"]);
const VIDEO_EXT = new Set(["mp4", "mov", "webm", "m4v"]);

export interface NormalizeContext {
  /** 0-based index of this post in its source posts_N.json. Combined with the
   *  source file's chunk number for global uniqueness across files. */
  postIndex: number;
  /** Numeric N from posts_N.json — for stable post ids across runs. */
  postsFileChunk: number;
  /** Comments keyed by media URI, joined from the comments JSON. */
  commentsByUri: ReadonlyMap<string, ReadonlyArray<{ text: string; author?: string; at?: Date }>>;
}

export function normalizePost(raw: RawMetaPost, ctx: NormalizeContext): Post | null {
  const mediaArr = Array.isArray(raw.media) ? raw.media : [];
  if (mediaArr.length === 0) return null;

  const postTimestamp =
    typeof raw.creation_timestamp === "number"
      ? raw.creation_timestamp
      : firstNumericTimestamp(mediaArr);
  if (postTimestamp === undefined) return null;

  const takenAt = new Date(postTimestamp * 1000);
  const id = synthesizeId(postTimestamp, ctx.postIndex, ctx.postsFileChunk);

  const caption = fixMojibake(raw.title ?? "");

  const normalizedMedia: Media[] = mediaArr.map((m, i) =>
    normalizeMedia(m, i, mediaArr.length, takenAt),
  );

  const location = liftLocation(mediaArr);

  // Concatenate comments from every media URI in the post (carousels share
  // a comment thread in IG, but Meta's export attaches them per-URI).
  const seen = new Set<string>();
  const comments: Post["comments"] = [];
  for (const m of mediaArr) {
    const found = ctx.commentsByUri.get(m.uri);
    if (!found) continue;
    for (const c of found) {
      const key = `${c.text}|${c.author ?? ""}|${c.at?.getTime() ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const comment: Post["comments"][number] = {
        text: c.text,
        ...(c.author === undefined ? {} : { author: c.author }),
        ...(c.at === undefined ? {} : { at: c.at }),
      };
      comments.push(comment);
    }
  }

  const crossPostSource =
    mediaArr.map((m) => m.cross_post_source?.source_app).find((s): s is string => !!s) ??
    undefined;

  return {
    id,
    caption,
    takenAt,
    media: normalizedMedia,
    ...(location ? { location } : {}),
    comments,
    ...(crossPostSource ? { crossPostSource } : {}),
  };
}

function normalizeMedia(
  raw: RawMetaMedia,
  indexInPost: number,
  postMediaCount: number,
  fallbackTakenAt: Date,
): Media {
  const filename = baseName(raw.uri);
  const kind = inferKind(filename);
  const takenAt =
    typeof raw.creation_timestamp === "number"
      ? new Date(raw.creation_timestamp * 1000)
      : fallbackTakenAt;

  const caption = raw.title ? fixMojibake(raw.title) : undefined;
  const location = locationFromMedia(raw);
  const camera = cameraFromMedia(raw);

  return {
    uri: raw.uri,
    filename,
    kind,
    takenAt,
    ...(caption ? { caption } : {}),
    ...(location ? { location } : {}),
    ...(camera ? { camera } : {}),
    indexInPost,
    postMediaCount,
  };
}

function inferKind(filename: string): MediaKind {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return "unknown";
}

function baseName(uri: string): string {
  const idx = Math.max(uri.lastIndexOf("/"), uri.lastIndexOf("\\"));
  return idx === -1 ? uri : uri.slice(idx + 1);
}

function firstNumericTimestamp(mediaArr: readonly RawMetaMedia[]): number | undefined {
  for (const m of mediaArr) {
    if (typeof m.creation_timestamp === "number") return m.creation_timestamp;
  }
  return undefined;
}

function synthesizeId(ts: number, postIndex: number, chunk: number): string {
  // base36 keeps it short and filesystem-safe.
  return `post_${ts.toString(36)}_c${chunk}_i${postIndex}`;
}

function liftLocation(mediaArr: readonly RawMetaMedia[]): Location | undefined {
  for (const m of mediaArr) {
    const loc = locationFromMedia(m);
    if (loc) return loc;
  }
  return undefined;
}

function locationFromMedia(m: RawMetaMedia): Location | undefined {
  // Prefer explicit `place` if present; otherwise lift from first EXIF entry.
  if (m.place && (m.place.latitude !== undefined || m.place.longitude !== undefined)) {
    if (typeof m.place.latitude === "number" && typeof m.place.longitude === "number") {
      const name = m.place.name ? fixMojibake(m.place.name) : undefined;
      const address = m.place.address ? fixMojibake(m.place.address) : undefined;
      return {
        latitude: m.place.latitude,
        longitude: m.place.longitude,
        ...(name ? { name } : {}),
        ...(address ? { address } : {}),
      };
    }
  }
  const exif = pickFirstExif(m);
  if (
    exif &&
    typeof exif.latitude === "number" &&
    typeof exif.longitude === "number" &&
    (exif.latitude !== 0 || exif.longitude !== 0)
  ) {
    return { latitude: exif.latitude, longitude: exif.longitude };
  }
  return undefined;
}

function cameraFromMedia(m: RawMetaMedia): CameraInfo | undefined {
  const exif = pickFirstExif(m);
  if (!exif) return undefined;
  const camera: CameraInfo = {};
  if (exif.camera_make) camera.make = exif.camera_make;
  if (exif.camera_model) camera.model = exif.camera_model;
  if (exif.lens_make) camera.lensMake = exif.lens_make;
  if (exif.lens_model) camera.lensModel = exif.lens_model;
  if (exif.software) camera.software = exif.software;
  if (exif.focal_length) camera.focalLength = exif.focal_length;
  if (exif.aperture) camera.aperture = exif.aperture;
  if (exif.shutter_speed) camera.shutterSpeed = exif.shutter_speed;
  if (typeof exif.iso === "number") camera.iso = exif.iso;
  else if (typeof exif.iso === "string") {
    const parsed = Number(exif.iso);
    if (Number.isFinite(parsed)) camera.iso = parsed;
  }
  return Object.keys(camera).length === 0 ? undefined : camera;
}

function pickFirstExif(m: RawMetaMedia): RawMetaExifEntry | undefined {
  const photo = m.media_metadata?.photo_metadata?.exif_data;
  if (Array.isArray(photo) && photo.length > 0) return photo[0];
  const video = m.media_metadata?.video_metadata?.exif_data;
  if (Array.isArray(video) && video.length > 0) return video[0];
  return undefined;
}
