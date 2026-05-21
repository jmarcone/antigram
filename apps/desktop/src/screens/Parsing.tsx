import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

export function Parsing() {
  const [discovery, setDiscovery] = useState<{
    postsJsonCount: number;
    mediaCount: number;
    exportVersion: string | null;
  } | null>(null);

  useEffect(() => {
    const unlisten = listen<typeof discovery>("antigram:discovery", (e) => {
      setDiscovery(e.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="max-w-2xl w-full text-center space-y-6">
      <Spinner />
      <h2 className="font-(family-name:--font-display) text-3xl tracking-tight">
        Reading your export
      </h2>
      <p className="text-sm text-(--color-ink-soft) max-w-prose mx-auto">
        Walking the ZIP without loading it into memory. Meta packs more in there
        than they show you on the website.
      </p>
      {discovery ? (
        <ul className="text-sm font-(family-name:--font-mono) text-(--color-ink-soft) inline-block text-left">
          <li>posts JSON files: {discovery.postsJsonCount}</li>
          <li>media entries: {discovery.mediaCount}</li>
          <li>
            export layout: {discovery.exportVersion ?? "(unknown)"}
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <div className="mx-auto w-10 h-10 rounded-full border-2 border-(--color-ink-soft)/30 border-t-(--color-accent) animate-spin" />
  );
}
