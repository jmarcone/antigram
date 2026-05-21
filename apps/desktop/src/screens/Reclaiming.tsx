import { useContext } from "react";
import { AppStateContext } from "../state";

export function Reclaiming() {
  const state = useContext(AppStateContext);
  const { index, total, mediaWritten, currentPostId } = state.reclaimProgress;
  const pct = total === 0 ? 0 : Math.min(100, Math.round((index / total) * 100));

  return (
    <div className="max-w-2xl w-full space-y-6">
      <header className="space-y-2">
        <h2 className="font-(family-name:--font-display) text-3xl tracking-tight">
          Reclaiming
        </h2>
        <p className="text-sm text-(--color-ink-soft) max-w-prose">
          Streaming each photo out of the ZIP, embedding the dates, GPS, and
          captions Meta stripped, then dropping them into your output folder.
        </p>
      </header>

      <div className="rounded-(--radius-card) bg-(--color-paper-elev) p-5 border border-black/5 dark:border-white/5">
        <div className="flex justify-between text-sm mb-2">
          <span>
            Post {index} of {total}
          </span>
          <span className="text-(--color-ink-soft)">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-(--color-ink)/10 overflow-hidden">
          <div
            className="h-full bg-(--color-accent) transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 text-xs font-(family-name:--font-mono) text-(--color-ink-soft) flex justify-between">
          <span>{mediaWritten} files written</span>
          {currentPostId ? <span className="truncate ml-3">{currentPostId}</span> : null}
        </div>
      </div>
    </div>
  );
}
