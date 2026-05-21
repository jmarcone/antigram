/**
 * Shared TypeScript types for the Antigram pipeline.
 *
 * Three layers:
 *
 *   1. {@link RawMetaPost} / {@link RawMetaMedia} — Meta's wire shape as
 *      it actually appears in posts_*.json. Lots of optionals because Meta
 *      drops fields silently between versions and account ages.
 *
 *   2. {@link Post} / {@link Media} — Antigram's normalized in-memory shape.
 *      Captions are de-mojibake'd, timestamps are Date objects, location is
 *      lifted out of the EXIF subarray, etc.
 *
 *   3. {@link ArchiveInfo} / {@link PostMetadataSidecar} — what the pipeline
 *      writes to disk next to the reclaimed photos.
 */

// ---------------------------------------------------------------------------
// Layer 1: raw Meta export wire shape
// ---------------------------------------------------------------------------

export interface RawMetaExifEntry {
  latitude?: number;
  longitude?: number;
  iso?: number | string;
  focal_length?: string;
  lens_make?: string;
  lens_model?: string;
  camera_make?: string;
  camera_model?: string;
  aperture?: string;
  shutter_speed?: string;
  metering_mode?: string;
  scene_capture_type?: string;
  software?: string;
  scene_type?: string;
  camera_position?: string;
  device_id?: string;
  source_type?: string;
  date_time_original?: string;
  date_time_digitized?: string;
  orientation?: number | string;
}

export interface RawMetaPhotoMetadata {
  exif_data?: RawMetaExifEntry[];
}

export interface RawMetaVideoMetadata {
  exif_data?: RawMetaExifEntry[];
  has_camera_metadata?: boolean;
}

export interface RawMetaMediaMetadata {
  photo_metadata?: RawMetaPhotoMetadata;
  video_metadata?: RawMetaVideoMetadata;
}

export interface RawMetaCrossPostSource {
  source_app?: string;
}

export interface RawMetaPlace {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface RawMetaMedia {
  uri: string;
  creation_timestamp?: number;
  title?: string;
  media_metadata?: RawMetaMediaMetadata;
  cross_post_source?: RawMetaCrossPostSource;
  backup_uri?: string;
  place?: RawMetaPlace;
}

export interface RawMetaPost {
  media: RawMetaMedia[];
  title?: string;
  creation_timestamp?: number;
}

/**
 * Comments live in a separate file. Shape varies by export version; this
 * captures the common fields seen across recent exports.
 */
export interface RawMetaComment {
  string_map_data?: {
    Comment?: { value?: string; timestamp?: number };
    Time?: { timestamp?: number };
    "Media Owner"?: { value?: string };
    Owner?: { value?: string };
  };
  title?: string;
  media_list_data?: Array<{ uri?: string; creation_timestamp?: number }>;
}

// ---------------------------------------------------------------------------
// Layer 2: Antigram's normalized in-memory shape
// ---------------------------------------------------------------------------

export type MediaKind = "image" | "video" | "unknown";

export interface Location {
  /** Source: EXIF latitude/longitude or place.latitude. */
  latitude: number;
  longitude: number;
  /** Source: place.name when present in the raw export. */
  name?: string;
  address?: string;
}

export interface CameraInfo {
  make?: string;
  model?: string;
  lensMake?: string;
  lensModel?: string;
  software?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
}

export interface Media {
  /** Path inside the ZIP, exactly as it appears in posts_*.json. */
  uri: string;
  /** Filename component only (basename of {@link uri}). */
  filename: string;
  /** Inferred from extension. */
  kind: MediaKind;
  /** When the original capture happened, per the export. */
  takenAt: Date;
  /** Per-media caption when present (rare; usually post-level). */
  caption?: string;
  location?: Location;
  camera?: CameraInfo;
  /** Sequence index within a multi-photo post (0-based). */
  indexInPost: number;
  /** Total media items in the parent post. Useful for "1of3" filenames. */
  postMediaCount: number;
}

export interface Comment {
  /** Comment body, de-mojibake'd. */
  text: string;
  /** Display name / handle of the commenter. */
  author?: string;
  /** When it was posted. */
  at?: Date;
}

export interface Post {
  /**
   * Stable synthetic id of the form "post_<base36-of-timestamp>_<index>".
   * Used in output filenames and sidecar JSON names. Reproducible across
   * runs so the user can re-process safely.
   */
  id: string;
  /** Post-level caption, de-mojibake'd. Empty string if Meta provided no title. */
  caption: string;
  /** When the post was published (or first media taken, if post lacks ts). */
  takenAt: Date;
  media: Media[];
  /** Lifted from media[0].location when present and uniform across the post. */
  location?: Location;
  /** Joined from the separate comments file at parse time. */
  comments: Comment[];
  /** Like count if available in the export (often absent for older accounts). */
  likeCount?: number;
  /** "FB" / "IG" / etc. */
  crossPostSource?: string;
}

// ---------------------------------------------------------------------------
// Layer 3: what we write to disk
// ---------------------------------------------------------------------------

/**
 * Written to _metadata/YYYY-MM/<post-id>.json next to the photos.
 * Preserves everything that doesn't fit in EXIF/XMP cleanly.
 */
export interface PostMetadataSidecar {
  id: string;
  caption: string;
  takenAt: string; // ISO 8601
  location?: Location;
  comments: Array<{ text: string; author?: string; at?: string }>;
  likeCount?: number;
  crossPostSource?: string;
  media: Array<{
    filename: string;
    kind: MediaKind;
    indexInPost: number;
    camera?: CameraInfo;
  }>;
  antigram: {
    version: string;
    /** ISO 8601, when this sidecar was written. */
    reclaimedAt: string;
  };
}

/**
 * Written to the root of the output folder. Single source of truth for
 * stats and provenance of a reclaimed archive.
 */
export interface ArchiveInfo {
  antigram: {
    version: string;
    reclaimedAt: string;
  };
  source: {
    /** Absolute path of the Meta export ZIP at reclaim time. */
    zipPath: string;
    /** SHA-256 of the ZIP. Lets the user verify provenance later. */
    zipSha256?: string;
    /** ISO 8601. */
    exportedAt?: string;
  };
  stats: {
    postCount: number;
    mediaCount: number;
    photoCount: number;
    videoCount: number;
    commentCount: number;
    firstPostAt?: string;
    lastPostAt?: string;
    yearsCovered: number[];
  };
}

// ---------------------------------------------------------------------------
// Progress events emitted during processing.
// Consumed by both the CLI (prints to stderr) and the Tauri UI (forwards
// over IPC to React).
// ---------------------------------------------------------------------------

export type ProgressEvent =
  | { kind: "discovery_started"; zipPath: string }
  | { kind: "discovery_done"; postCount: number; mediaCount: number }
  | { kind: "post_processing"; postId: string; index: number; total: number }
  | { kind: "media_written"; postId: string; outPath: string }
  | { kind: "post_done"; postId: string; index: number; total: number }
  | { kind: "all_done"; outputRoot: string; mediaWritten: number }
  | { kind: "error"; postId?: string; message: string };

export type ProgressListener = (event: ProgressEvent) => void;
