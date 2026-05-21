import { useContext, useMemo, useState } from "react";
import { AppDispatchContext, AppStateContext } from "../state";
import { listenProgress, reclaim, type SerializedPost } from "../lib/pipeline";

export function Gallery() {
  const state = useContext(AppStateContext);
  const dispatch = useContext(AppDispatchContext);
  const [filter, setFilter] = useState("");
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const p of state.posts) set.add(p.takenYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [state.posts]);

  const visiblePosts = useMemo(() => {
    return state.posts.filter((p) => {
      if (yearFilter !== "all" && p.takenYear !== yearFilter) return false;
      if (filter.trim().length === 0) return true;
      return p.caption.toLowerCase().includes(filter.toLowerCase());
    });
  }, [state.posts, filter, yearFilter]);

  const selectedCount = state.selectedPostIds.size;
  const selectedMediaCount = useMemo(() => {
    let n = 0;
    for (const p of state.posts) {
      if (state.selectedPostIds.has(p.id)) n += p.media.length;
    }
    return n;
  }, [state.posts, state.selectedPostIds]);

  async function startReclaim() {
    if (!state.zipPath || !state.outputRoot) return;
    setBusy(true);
    setErr(null);
    dispatch({ type: "reclaim_start" });

    const unlisten = await listenProgress((event) => {
      if (event.k === "reclaim_start") {
        dispatch({ type: "reclaim_progress", progress: { total: event.total } });
      } else if (event.k === "post_start") {
        dispatch({
          type: "reclaim_progress",
          progress: {
            index: event.index + 1,
            total: event.total,
            currentPostId: event.postId,
          },
        });
      } else if (event.k === "media_written") {
        dispatch({
          type: "reclaim_progress",
          progress: { mediaWritten: state.reclaimProgress.mediaWritten + 1 },
        });
      }
    });

    try {
      const result = await reclaim(
        state.zipPath,
        state.outputRoot,
        Array.from(state.selectedPostIds),
      );
      dispatch({
        type: "reclaim_done",
        outputRoot: result.outputRoot,
        mediaWritten: result.mediaWritten,
        warnings: result.warnings,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message);
      dispatch({ type: "error", message });
    } finally {
      unlisten();
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl w-full">
      <header className="flex flex-wrap items-end gap-4 justify-between mb-6">
        <div>
          <h2 className="font-(family-name:--font-display) text-3xl tracking-tight">
            {state.posts.length} posts found
          </h2>
          <p className="text-sm text-(--color-ink-soft)">
            {years.length > 0
              ? `${years.at(-1)} → ${years[0]}`
              : ""}{" "}
            · pick what you want back
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            placeholder="Search captions…"
            className="rounded-md border border-black/10 dark:border-white/10 bg-(--color-paper-elev) px-3 py-1.5 text-sm w-64"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            value={yearFilter}
            onChange={(e) =>
              setYearFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="rounded-md border border-black/10 dark:border-white/10 bg-(--color-paper-elev) px-3 py-1.5 text-sm"
          >
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex gap-2 mb-3 text-xs">
        <button
          className="underline text-(--color-ink-soft) hover:text-(--color-ink)"
          onClick={() => dispatch({ type: "select_all", on: true })}
        >
          Select all
        </button>
        <span className="text-(--color-ink-soft)/40">·</span>
        <button
          className="underline text-(--color-ink-soft) hover:text-(--color-ink)"
          onClick={() => dispatch({ type: "select_all", on: false })}
        >
          Clear
        </button>
        {years.map((y) => (
          <span key={y} className="contents">
            <span className="text-(--color-ink-soft)/40">·</span>
            <button
              className="underline text-(--color-ink-soft) hover:text-(--color-ink)"
              onClick={() => dispatch({ type: "select_year", year: y })}
            >
              Select {y}
            </button>
          </span>
        ))}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {visiblePosts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            selected={state.selectedPostIds.has(p.id)}
            onToggle={() => dispatch({ type: "toggle_post", postId: p.id })}
          />
        ))}
      </ul>

      <footer className="sticky bottom-0 mt-6 pt-4 bg-gradient-to-t from-(--color-paper) to-transparent dark:from-(--color-ink) dark:to-transparent">
        <button
          disabled={selectedCount === 0 || busy}
          onClick={startReclaim}
          className="w-full rounded-(--radius-card) bg-(--color-accent) text-white py-3.5 px-6 font-medium tracking-tight transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)]"
        >
          {busy
            ? "Reclaiming…"
            : selectedCount === 0
              ? "Pick at least one post"
              : `Reclaim ${selectedCount} post${selectedCount === 1 ? "" : "s"} (${selectedMediaCount} media)`}
        </button>
        {err ? (
          <p className="text-(--color-bad) text-sm mt-2 whitespace-pre-wrap">{err}</p>
        ) : null}
      </footer>
    </div>
  );
}

function PostCard({
  post,
  selected,
  onToggle,
}: {
  post: SerializedPost;
  selected: boolean;
  onToggle: () => void;
}) {
  const date = new Date(post.takenAt);
  return (
    <li
      onClick={onToggle}
      className={`cursor-pointer rounded-(--radius-card) p-3 border transition select-none
        ${selected ? "border-(--color-accent) bg-(--color-accent-soft)/30" : "border-black/5 dark:border-white/5 bg-(--color-paper-elev) hover:border-black/15"}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 w-4 h-4 shrink-0 rounded-full border ${
            selected
              ? "bg-(--color-accent) border-(--color-accent)"
              : "border-(--color-ink-soft)"
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-(--color-ink-soft) font-(family-name:--font-mono)">
            {date.toISOString().slice(0, 10)} · {post.media.length}{" "}
            {post.media.length === 1 ? "photo" : "photos"}
            {post.location ? " · 📍" : ""}
          </div>
          <p className="mt-1 text-sm line-clamp-3 break-words">
            {post.caption.length > 0 ? (
              post.caption
            ) : (
              <span className="text-(--color-ink-soft) italic">no caption</span>
            )}
          </p>
          {post.comments.length > 0 ? (
            <p className="mt-1 text-xs text-(--color-ink-soft)">
              {post.comments.length} comment{post.comments.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}
