/**
 * Pure conversion from Antigram's normalized {@link Media} to exiftool tag
 * key/value pairs. Kept separate from the writer so it's trivially testable.
 *
 * The tags chosen are the universal ones — what Apple Photos, Google Photos,
 * Lightroom, Immich, Synology Photo Station all read natively:
 *
 *   - DateTimeOriginal     when the photo was taken
 *   - CreateDate           same value (some readers prefer this one)
 *   - GPSLatitude/Ref      latitude with N/S hemisphere
 *   - GPSLongitude/Ref     longitude with E/W hemisphere
 *   - ImageDescription     the Instagram caption
 *   - Make / Model         camera make and model (from Meta's EXIF subarray)
 *   - Software             value preserved if Meta recorded it
 *
 * IG-specific data (like counts, comments, tagged users, carousel position)
 * doesn't fit cleanly in EXIF and lives in the sidecar JSON instead.
 */

import type { Media } from "@antigram/types";

export interface ExifTagSet {
  /** exiftool tag name → value. Strings or numbers. */
  tags: Record<string, string | number>;
  /** Extra command-line args passed verbatim (e.g. -charset). */
  extraArgs: string[];
}

/**
 * Build the exiftool tag map and extra args for a single media entry.
 * The post-level caption is passed explicitly because Media itself only
 * carries per-media captions (which Meta rarely populates).
 */
export function buildExifTagSet(media: Media, postCaption: string): ExifTagSet {
  const tags: Record<string, string | number> = {};
  const extraArgs: string[] = ["-overwrite_original", "-codedcharacterset=utf8"];

  const dt = formatExifDate(media.takenAt);
  tags.DateTimeOriginal = dt;
  tags.CreateDate = dt;
  tags.ModifyDate = dt;

  const caption = media.caption ?? postCaption;
  if (caption.length > 0) {
    tags.ImageDescription = caption;
    tags["XPComment"] = caption; // Windows file-explorer "Comments" column
  }

  if (media.location) {
    const { latitude, longitude } = media.location;
    tags.GPSLatitude = Math.abs(latitude);
    tags.GPSLatitudeRef = latitude >= 0 ? "N" : "S";
    tags.GPSLongitude = Math.abs(longitude);
    tags.GPSLongitudeRef = longitude >= 0 ? "E" : "W";
  }

  if (media.camera) {
    if (media.camera.make) tags.Make = media.camera.make;
    if (media.camera.model) tags.Model = media.camera.model;
    if (media.camera.lensModel) tags.LensModel = media.camera.lensModel;
    if (media.camera.software) tags.Software = media.camera.software;
    if (media.camera.iso !== undefined) tags.ISO = media.camera.iso;
  }

  // Source flag so future Antigram runs can detect their own writes.
  tags["XMP-xmp:CreatorTool"] = "Antigram";

  return { tags, extraArgs };
}

/**
 * Format a Date as the "YYYY:MM:DD HH:MM:SS" string exiftool expects in
 * DateTimeOriginal and friends. UTC — Meta's timestamps are already UTC.
 */
export function formatExifDate(date: Date): string {
  const yyyy = date.getUTCFullYear().toString().padStart(4, "0");
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = date.getUTCDate().toString().padStart(2, "0");
  const hh = date.getUTCHours().toString().padStart(2, "0");
  const mi = date.getUTCMinutes().toString().padStart(2, "0");
  const ss = date.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}:${mm}:${dd} ${hh}:${mi}:${ss}`;
}
