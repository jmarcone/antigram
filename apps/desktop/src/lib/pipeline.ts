/**
 * Thin React-side wrapper over the Tauri commands and progress events.
 * All async/streaming work lives here; the screens are pure UI.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";

export interface SerializedPost {
  id: string;
  caption: string;
  takenAt: string;
  takenYear: number;
  takenMonth: number;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  comments: Array<{ text: string; author?: string; at?: string }>;
  likeCount?: number;
  crossPostSource?: string;
  media: Array<{
    uri: string;
    filename: string;
    kind: string;
    indexInPost: number;
    postMediaCount: number;
  }>;
}

export interface ParseSummary {
  posts: SerializedPost[];
  warnings: string[];
}

export interface ReclaimSummary {
  outputRoot: string;
  mediaWritten: number;
  warnings: string[];
}

export interface DoctorInfo {
  workspaceRoot: string;
  sidecarPath: string;
  sidecarExists: boolean;
  nodeVersion: string | null;
}

export type ProgressEnvelope =
  | { k: "reclaim_start"; total: number }
  | { k: "post_start"; postId: string; index: number; total: number }
  | { k: "media_written"; postId: string; absPath: string }
  | { k: "post_done"; postId: string; index: number; total: number };

export async function pickZip(): Promise<string | null> {
  const sel = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Instagram export", extensions: ["zip"] }],
  });
  return typeof sel === "string" ? sel : null;
}

export async function pickFolder(): Promise<string | null> {
  const sel = await open({ multiple: false, directory: true });
  return typeof sel === "string" ? sel : null;
}

export async function parseExport(zipPath: string): Promise<ParseSummary> {
  return invoke<ParseSummary>("parse_export", { zipPath });
}

export async function reclaim(
  zipPath: string,
  outputRoot: string,
  postIds: string[],
): Promise<ReclaimSummary> {
  return invoke<ReclaimSummary>("reclaim", { zipPath, outputRoot, postIds });
}

export async function doctor(): Promise<DoctorInfo> {
  return invoke<DoctorInfo>("doctor");
}

export async function listenProgress(
  fn: (event: ProgressEnvelope) => void,
): Promise<UnlistenFn> {
  return listen<ProgressEnvelope>("antigram:progress", (e) => fn(e.payload));
}

export async function revealInExplorer(p: string): Promise<void> {
  await openPath(p);
}
