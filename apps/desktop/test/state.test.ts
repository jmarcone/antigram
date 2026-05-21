/**
 * Pure unit tests for the app state machine. No DOM, no IO — every action
 * gets a fresh reducer call against a known starting state.
 */

import { describe, expect, it } from "vitest";
import { initialState, reduce, type AppAction, type AppState } from "../src/state";
import type { SerializedPost } from "../src/lib/pipeline";

function makePost(over: Partial<SerializedPost> = {}): SerializedPost {
  return {
    id: "post_a",
    caption: "caption",
    takenAt: "2020-05-01T00:00:00.000Z",
    takenYear: 2020,
    takenMonth: 5,
    comments: [],
    media: [
      {
        uri: "media/posts/202005/a_0.jpg",
        filename: "a_0.jpg",
        kind: "image",
        indexInPost: 0,
        postMediaCount: 1,
      },
    ],
    ...over,
  };
}

function apply(state: AppState, ...actions: AppAction[]): AppState {
  return actions.reduce<AppState>(reduce, state);
}

describe("initialState", () => {
  it("starts on the welcome screen with no data", () => {
    expect(initialState.phase).toBe("welcome");
    expect(initialState.zipPath).toBeUndefined();
    expect(initialState.outputRoot).toBeUndefined();
    expect(initialState.posts).toEqual([]);
    expect(initialState.selectedPostIds.size).toBe(0);
    expect(initialState.error).toBeNull();
  });
});

describe("file selection actions", () => {
  it("select_zip stashes the path without changing phase", () => {
    const next = reduce(initialState, { type: "select_zip", zipPath: "/x.zip" });
    expect(next.zipPath).toBe("/x.zip");
    expect(next.phase).toBe("welcome");
  });

  it("select_output stashes the path without changing phase", () => {
    const next = reduce(initialState, { type: "select_output", outputRoot: "/out" });
    expect(next.outputRoot).toBe("/out");
    expect(next.phase).toBe("welcome");
  });
});

describe("parse lifecycle", () => {
  it("parse_start transitions to 'parsing' and clears any prior error", () => {
    const start = apply(initialState, { type: "error", message: "old" }, { type: "parse_start" });
    expect(start.phase).toBe("parsing");
    expect(start.error).toBeNull();
    expect(start.warnings).toEqual([]);
  });

  it("parse_done transitions to 'gallery' with posts and full selection", () => {
    const posts = [makePost({ id: "a" }), makePost({ id: "b" }), makePost({ id: "c" })];
    const next = apply(initialState, { type: "parse_start" }, {
      type: "parse_done",
      posts,
      warnings: ["w1"],
    });
    expect(next.phase).toBe("gallery");
    expect(next.posts).toHaveLength(3);
    expect(next.warnings).toEqual(["w1"]);
    expect(Array.from(next.selectedPostIds).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("selection actions in the gallery phase", () => {
  function withPosts(): AppState {
    return apply(initialState, { type: "parse_start" }, {
      type: "parse_done",
      posts: [
        makePost({ id: "a", takenYear: 2020 }),
        makePost({ id: "b", takenYear: 2020 }),
        makePost({ id: "c", takenYear: 2024 }),
      ],
      warnings: [],
    });
  }

  it("toggle_post adds an unselected post and removes a selected one", () => {
    const cleared = apply(withPosts(), { type: "select_all", on: false });
    expect(cleared.selectedPostIds.size).toBe(0);

    const oneOn = apply(cleared, { type: "toggle_post", postId: "a" });
    expect(Array.from(oneOn.selectedPostIds)).toEqual(["a"]);

    const oneOff = apply(oneOn, { type: "toggle_post", postId: "a" });
    expect(oneOff.selectedPostIds.size).toBe(0);
  });

  it("select_all true picks every post; false picks none", () => {
    const all = apply(withPosts(), { type: "select_all", on: true });
    expect(all.selectedPostIds.size).toBe(3);
    const none = apply(all, { type: "select_all", on: false });
    expect(none.selectedPostIds.size).toBe(0);
  });

  it("select_year unions in just the posts from that year", () => {
    const start = apply(withPosts(), { type: "select_all", on: false });
    const after = apply(start, { type: "select_year", year: 2020 });
    expect(Array.from(after.selectedPostIds).sort()).toEqual(["a", "b"]);
  });

  it("select_year is additive — it doesn't clear existing selections from other years", () => {
    const start = apply(withPosts(), { type: "select_all", on: false }, {
      type: "toggle_post",
      postId: "c",
    });
    const after = apply(start, { type: "select_year", year: 2020 });
    expect(Array.from(after.selectedPostIds).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("reclaim lifecycle", () => {
  function readyToReclaim(): AppState {
    return apply(initialState, { type: "parse_start" }, {
      type: "parse_done",
      posts: [makePost({ id: "a" }), makePost({ id: "b" })],
      warnings: [],
    });
  }

  it("reclaim_start transitions to 'reclaiming' and zeroes the per-run counters", () => {
    const state = apply(readyToReclaim(), { type: "reclaim_start" });
    expect(state.phase).toBe("reclaiming");
    expect(state.reclaimProgress).toEqual({ index: 0, total: 2, mediaWritten: 0 });
  });

  it("reclaim_progress merges partial updates into reclaimProgress", () => {
    const s = apply(readyToReclaim(), { type: "reclaim_start" }, {
      type: "reclaim_progress",
      progress: { index: 1 },
    });
    expect(s.reclaimProgress.index).toBe(1);
    expect(s.reclaimProgress.total).toBe(2);
    expect(s.reclaimProgress.mediaWritten).toBe(0);
  });

  it("reclaim_done transitions to 'done' and appends warnings", () => {
    const s = apply(
      readyToReclaim(),
      { type: "reclaim_start" },
      { type: "reclaim_progress", progress: { mediaWritten: 5 } },
      {
        type: "reclaim_done",
        outputRoot: "/out",
        mediaWritten: 5,
        warnings: ["bad-jpeg"],
      },
    );
    expect(s.phase).toBe("done");
    expect(s.outputRoot).toBe("/out");
    expect(s.reclaimProgress.mediaWritten).toBe(5);
    expect(s.warnings).toEqual(["bad-jpeg"]);
  });
});

describe("error / go_back / reset", () => {
  it("error bounces back to welcome and stores the message", () => {
    // Simulate the path users actually hit: parse_start → error.
    const s = apply(initialState, { type: "parse_start" }, {
      type: "error",
      message: "boom",
    });
    expect(s.phase).toBe("welcome");
    expect(s.error).toBe("boom");
  });

  it("error preserves zipPath/outputRoot so the user doesn't have to re-pick", () => {
    const s = apply(
      initialState,
      { type: "select_zip", zipPath: "/z.zip" },
      { type: "select_output", outputRoot: "/o" },
      { type: "parse_start" },
      { type: "error", message: "boom" },
    );
    expect(s.phase).toBe("welcome");
    expect(s.zipPath).toBe("/z.zip");
    expect(s.outputRoot).toBe("/o");
  });

  it("go_back returns to welcome and clears any prior error", () => {
    const s = apply(
      initialState,
      { type: "select_zip", zipPath: "/z.zip" },
      { type: "parse_start" },
      { type: "parse_done", posts: [makePost()], warnings: [] },
      { type: "go_back" },
    );
    expect(s.phase).toBe("welcome");
    expect(s.error).toBeNull();
    // Keeps the picks.
    expect(s.zipPath).toBe("/z.zip");
  });

  it("reset returns to the initial state", () => {
    const s = apply(initialState, { type: "parse_start" }, {
      type: "parse_done",
      posts: [makePost()],
      warnings: [],
    }, { type: "reset" });
    expect(s).toEqual(initialState);
  });
});
