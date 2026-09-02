import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card p-8 text-center">
      <h1 className="text-lg font-bold text-ink">Not found</h1>
      <p className="mt-1 text-sm text-slate">That coordination item does not exist, or the demo has been reset.</p>
      <Link href="/queue" className="btn-primary mt-4">
        Back to the attention queue
      </Link>
    </div>
  );
}
