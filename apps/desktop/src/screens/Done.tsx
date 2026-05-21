import { useContext, useState } from "react";
import { AppDispatchContext, AppStateContext } from "../state";
import { revealInExplorer } from "../lib/pipeline";

export function Done() {
  const state = useContext(AppStateContext);
  const dispatch = useContext(AppDispatchContext);
  const [err, setErr] = useState<string | null>(null);

  async function reveal() {
    if (!state.outputRoot) return;
    try {
      await revealInExplorer(state.outputRoot);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="max-w-2xl w-full space-y-8">
      <header className="space-y-2">
        <h2 className="font-(family-name:--font-display) text-4xl tracking-tight">
          They're yours.
        </h2>
        <p className="text-(--color-ink-soft) max-w-prose">
          {state.reclaimProgress.mediaWritten} photo
          {state.reclaimProgress.mediaWritten === 1 ? "" : "s"} reclaimed from
          Meta. The folder drops straight into Apple Photos, Google Photos,
          Immich, or whatever else you want.
        </p>
      </header>

      {state.outputRoot ? (
        <div className="rounded-(--radius-card) bg-(--color-paper-elev) p-4 border border-black/5 dark:border-white/5">
          <p className="text-xs text-(--color-ink-soft) mb-1">Output folder</p>
          <code className="font-(family-name:--font-mono) text-sm break-all">
            {state.outputRoot}
          </code>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={reveal}
          className="rounded-(--radius-card) bg-(--color-ink) text-(--color-paper) px-5 py-3 text-sm hover:opacity-90 transition"
        >
          Open the folder
        </button>
        <button
          onClick={() => dispatch({ type: "reset" })}
          className="rounded-(--radius-card) bg-(--color-paper-elev) text-(--color-ink) px-5 py-3 text-sm border border-black/10 dark:border-white/10 hover:bg-black/5 transition"
        >
          Reclaim another archive
        </button>
      </div>

      {err ? <p className="text-(--color-bad) text-sm">{err}</p> : null}

      {state.warnings.length > 0 ? (
        <details className="text-xs text-(--color-ink-soft)">
          <summary className="cursor-pointer">
            {state.warnings.length} warning{state.warnings.length === 1 ? "" : "s"}
            {" "}during processing
          </summary>
          <ul className="mt-2 ml-4 list-disc space-y-1 max-h-40 overflow-y-auto">
            {state.warnings.map((w, i) => (
              <li key={i} className="break-words">{w}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
