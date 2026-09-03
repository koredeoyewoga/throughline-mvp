import Link from "next/link";

export const metadata = { title: "Offline — Throughline" };

export default function OfflinePage() {
  return (
    <div className="card p-8 text-center">
      <h1 className="text-lg font-bold text-ink">You&rsquo;re offline</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate">
        The last version of the pages you visited is still available. Anything you approve or action while offline is
        held and syncs automatically when you&rsquo;re back on wifi.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Link href="/queue" className="btn-primary">
          Attention queue
        </Link>
        <Link href="/worklist" className="btn-secondary">
          Worklist
        </Link>
      </div>
    </div>
  );
}
