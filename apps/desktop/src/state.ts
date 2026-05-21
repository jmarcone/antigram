/**
 * App state machine. Five phases, each with the data it needs.
 *
 *   welcome    →  no data, just the drop-zone
 *   parsing    →  reading the ZIP, building SerializedPost[]
 *   gallery    →  user picks which posts to reclaim
 *   reclaiming →  pipeline running, progress events flowing
 *   done       →  output folder ready, "Reveal in Explorer" button
 */

import { createContext } from "react";
import type { SerializedPost } from "./lib/pipeline";

export type Phase = "welcome" | "parsing" | "gallery" | "reclaiming" | "done";

export interface ParseProgress {
  postCount?: number;
  mediaCount?: number;
}

export interface ReclaimProgress {
  index: number;
  total: number;
  currentPostId?: string;
  mediaWritten: number;
}

export interface AppState {
  phase: Phase;
  /** Path of the Meta export ZIP the user dropped. */
  zipPath?: string;
  /** Path the user chose for the reclaimed output. */
  outputRoot?: string;
  /** Posts after a successful parse. */
  posts: SerializedPost[];
  /** Set of post.id values the user has selected. */
  selectedPostIds: Set<string>;
  parseProgress: ParseProgress;
  reclaimProgress: ReclaimProgress;
  /** Cumulative warnings from parse + reclaim. */
  warnings: string[];
  /** User-visible error (terminates the flow). */
  error: string | null;
}

export const initialState: AppState = {
  phase: "welcome",
  posts: [],
  selectedPostIds: new Set(),
  parseProgress: {},
  reclaimProgress: { index: 0, total: 0, mediaWritten: 0 },
  warnings: [],
  error: null,
};

export type AppAction =
  | { type: "select_zip"; zipPath: string }
  | { type: "select_output"; outputRoot: string }
  | { type: "parse_start" }
  | { type: "parse_progress"; progress: ParseProgress }
  | { type: "parse_done"; posts: SerializedPost[]; warnings: string[] }
  | { type: "toggle_post"; postId: string }
  | { type: "select_all"; on: boolean }
  | { type: "select_year"; year: number }
  | { type: "reclaim_start" }
  | { type: "reclaim_progress"; progress: Partial<ReclaimProgress> }
  | { type: "reclaim_done"; outputRoot: string; mediaWritten: number; warnings: string[] }
  | { type: "error"; message: string }
  | { type: "go_back" }
  | { type: "reset" };

export function reduce(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "select_zip":
      return { ...state, zipPath: action.zipPath };
    case "select_output":
      return { ...state, outputRoot: action.outputRoot };
    case "parse_start":
      return { ...state, phase: "parsing", parseProgress: {}, warnings: [], error: null };
    case "parse_progress":
      return { ...state, parseProgress: { ...state.parseProgress, ...action.progress } };
    case "parse_done":
      return {
        ...state,
        phase: "gallery",
        posts: action.posts,
        warnings: action.warnings,
        selectedPostIds: new Set(action.posts.map((p) => p.id)),
      };
    case "toggle_post": {
      const next = new Set(state.selectedPostIds);
      if (next.has(action.postId)) next.delete(action.postId);
      else next.add(action.postId);
      return { ...state, selectedPostIds: next };
    }
    case "select_all":
      return {
        ...state,
        selectedPostIds: action.on ? new Set(state.posts.map((p) => p.id)) : new Set(),
      };
    case "select_year": {
      const next = new Set(state.selectedPostIds);
      for (const p of state.posts) {
        if (p.takenYear === action.year) next.add(p.id);
      }
      return { ...state, selectedPostIds: next };
    }
    case "reclaim_start":
      return {
        ...state,
        phase: "reclaiming",
        reclaimProgress: { index: 0, total: state.selectedPostIds.size, mediaWritten: 0 },
      };
    case "reclaim_progress":
      return {
        ...state,
        reclaimProgress: { ...state.reclaimProgress, ...action.progress },
      };
    case "reclaim_done":
      return {
        ...state,
        phase: "done",
        outputRoot: action.outputRoot,
        warnings: [...state.warnings, ...action.warnings],
        reclaimProgress: { ...state.reclaimProgress, mediaWritten: action.mediaWritten },
      };
    case "error":
      // Always return the user to a recoverable surface: keep the picks
      // they made (zipPath, outputRoot) so they can retry without redoing
      // the whole file-picker dance, but bounce out of parsing/reclaiming
      // so they aren't stuck on a frozen spinner.
      return { ...state, phase: "welcome", error: action.message };
    case "go_back":
      // Manual "back to start" from the gallery. Same shape as error but
      // without the error message.
      return { ...state, phase: "welcome", error: null };
    case "reset":
      return initialState;
  }
}

export const AppStateContext = createContext<AppState>(initialState);
export const AppDispatchContext = createContext<React.Dispatch<AppAction>>(() => {
  /* no-op default */
});
