"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { countPending, drainPending } from "@/lib/offline-queue";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  const refreshPending = useCallback(async () => {
    setPending(await countPending());
  }, []);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    const { sent, remaining } = await drainPending();
    setPending(remaining);
    setSyncing(false);
    if (sent > 0) router.refresh();
  }, [router, syncing]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshPending();

    // The service worker only adds read/offline caching; register it in
    // production so it does not interfere with the dev server or e2e runs.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);
    const onQueued = () => void refreshPending();
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("throughline:queued", onQueued);
    window.addEventListener("beforeinstallprompt", onInstall);

    if (navigator.onLine) void sync();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("throughline:queued", onQueued);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  const showBar = !online || pending > 0 || !!installEvent;

  return (
    <>
      {children}
      {showBar && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-center gap-3 border-t border-line bg-white/95 px-4 py-2 text-xs backdrop-blur"
        >
          {!online && (
            <span className="flex items-center gap-1.5 font-semibold text-amber">
              <span className="h-2 w-2 rounded-full bg-amber" aria-hidden />
              Offline — showing the last synced view
            </span>
          )}
          {pending > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-slate">
              {syncing ? "Syncing" : online ? "Waiting to sync" : "Held"} {pending} action{pending === 1 ? "" : "s"}
              {online && !syncing && (
                <button className="font-semibold text-teal hover:underline" onClick={() => void sync()}>
                  retry now
                </button>
              )}
            </span>
          )}
          {installEvent && online && (
            <button className="rounded-lg border border-teal bg-teal px-2.5 py-1 font-semibold text-white" onClick={install}>
              Install app
            </button>
          )}
        </div>
      )}
    </>
  );
}
