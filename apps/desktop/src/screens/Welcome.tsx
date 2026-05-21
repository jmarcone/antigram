import { useContext, useState } from "react";
import { AppDispatchContext, AppStateContext } from "../state";
import { parseExport, pickFolder, pickZip } from "../lib/pipeline";

export function Welcome() {
  const state = useContext(AppStateContext);
  const dispatch = useContext(AppDispatchContext);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canBegin = Boolean(state.zipPath && state.outputRoot) && !busy;

  async function chooseZip() {
    const p = await pickZip();
    if (p) dispatch({ type: "select_zip", zipPath: p });
  }

  async function chooseFolder() {
    const p = await pickFolder();
    if (p) dispatch({ type: "select_output", outputRoot: p });
  }

  async function begin() {
    if (!state.zipPath || !state.outputRoot) return;
    setBusy(true);
    setErr(null);
    dispatch({ type: "parse_start" });
    try {
      const result = await parseExport(state.zipPath);
      dispatch({
        type: "parse_done",
        posts: result.posts,
        warnings: result.warnings,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      dispatch({ type: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl w-full">
      <Header />
      <div className="mt-12 grid gap-5">
        <Step
          label="1. Your Meta export ZIP"
          value={state.zipPath ?? null}
          buttonLabel={state.zipPath ? "Change file" : "Choose ZIP…"}
          onClick={chooseZip}
        />
        <Step
          label="2. Where to put the reclaimed photos"
          value={state.outputRoot ?? null}
          buttonLabel={state.outputRoot ? "Change folder" : "Choose folder…"}
          onClick={chooseFolder}
        />
        <button
          className="mt-4 w-full rounded-(--radius-card) bg-(--color-accent) text-white py-3.5 px-6 font-medium tracking-tight transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)]"
          disabled={!canBegin}
          onClick={begin}
        >
          {busy ? "Working…" : "Read my export"}
        </button>
        {err ? (
          <p className="text-(--color-bad) text-sm mt-2 whitespace-pre-wrap">{err}</p>
        ) : null}
      </div>
      <Footnote />
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-3">
      <h1 className="font-(family-name:--font-display) text-5xl sm:text-6xl font-medium tracking-tight">
        Antigram
      </h1>
      <p className="text-lg text-(--color-ink-soft) max-w-prose">
        Your Instagram. <span className="font-semibold">Finally yours.</span>
      </p>
      <p className="text-sm text-(--color-ink-soft) max-w-prose">
        Drop the ZIP Meta sent you. Antigram turns it into a folder of dated,
        geotagged, captioned photos that drop straight into Apple Photos, Google
        Photos, or Immich. Nothing leaves your machine.
      </p>
    </header>
  );
}

function Step({
  label,
  value,
  buttonLabel,
  onClick,
}: {
  label: string;
  value: string | null;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-card) bg-(--color-paper-elev) p-4 border border-black/5 dark:border-white/5">
      <div className="flex justify-between items-center gap-4">
        <span className="text-sm text-(--color-ink-soft)">{label}</span>
        <button
          onClick={onClick}
          className="px-3 py-1.5 rounded-md text-sm bg-(--color-ink) text-(--color-paper) hover:bg-(--color-ink-soft) transition"
        >
          {buttonLabel}
        </button>
      </div>
      {value ? (
        <code className="text-xs font-(family-name:--font-mono) text-(--color-ink-soft) break-all">
          {value}
        </code>
      ) : null}
    </div>
  );
}

function Footnote() {
  return (
    <p className="mt-12 text-xs text-(--color-ink-soft)/70 max-w-prose">
      Don't have a Meta export yet? Visit{" "}
      <code className="font-(family-name:--font-mono)">
        accountscenter.instagram.com
      </code>{" "}
      → <em>Download your information</em> → JSON, all content, high quality.
      Meta emails you when the ZIP is ready (1–48h).
    </p>
  );
}
