import type { EvidenceItem } from "@/domain/types";
import { orgName } from "@/data/world";
import { sinceNow, shortDate } from "@/lib/format";

export function EvidenceList({
  items,
  eventOrgs,
}: {
  items: EvidenceItem[];
  eventOrgs: Record<string, string>;
}) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => {
        const isGap = it.eventId.startsWith("gap:");
        const org = eventOrgs[it.eventId];
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isGap ? "bg-amber" : "bg-teal-bright"}`}
                aria-hidden
              />
              {i < items.length - 1 && <span className="w-px flex-1 bg-line" aria-hidden />}
            </div>
            <div className="pb-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-muted">
                <span className="font-semibold text-ink">{it.label}</span>
                {!isGap && <span>· {shortDate(it.at)} ({sinceNow(it.at)})</span>}
                {org && <span>· {orgName(org)}</span>}
              </div>
              <p className="mt-0.5 text-sm text-slate">{it.detail}</p>
              {it.quote && (
                <blockquote className="mt-1 border-l-2 border-line pl-3 text-sm italic text-ink">
                  “{it.quote}”
                </blockquote>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
