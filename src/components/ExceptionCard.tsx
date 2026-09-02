import Link from "next/link";
import type { Exception } from "@/domain/types";
import { SeverityBadge, StatusBadge } from "./Badge";
import { patternLabel, realSince } from "@/lib/format";
import { patientName } from "@/data/patients";

export function ExceptionCard({ exception }: { exception: Exception }) {
  const e = exception;
  const patient = patientName(e.patientId);
  const dob = "";

  return (
    <Link
      href={`/exceptions/${e.id}`}
      className="card block p-4 transition-shadow hover:shadow-md focus-visible:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={e.severity} />
          <span className="pill bg-white text-slate-muted ring-1 ring-inset ring-line">{patternLabel(e.pattern)}</span>
          {e.needsFactCheck && (
            <span className="pill bg-amber-soft text-amber" title="A fact-check flag was raised by the governance check">
              Fact-check
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-muted">Score {e.score}</span>
          <StatusBadge status={e.status} />
        </div>
      </div>

      <h3 className="mt-2 text-[15px] font-semibold text-ink">{e.title}</h3>

      <p className="mt-1 line-clamp-2 text-sm text-slate">{e.why}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="label">Patient</dt>
          <dd className="font-medium text-ink">
            {patient}
            {dob}
          </dd>
        </div>
        <div>
          <dt className="label">Owner</dt>
          <dd className="font-medium text-ink">{e.owner.label}</dd>
        </div>
        <div>
          <dt className="label">Recommended</dt>
          <dd className="truncate font-medium text-ink" title={e.recommendedAction}>
            {e.recommendedAction}
          </dd>
        </div>
        <div>
          <dt className="label">Surfaced</dt>
          <dd className="font-medium text-ink">{realSince(e.createdAt)}</dd>
        </div>
      </dl>
    </Link>
  );
}
