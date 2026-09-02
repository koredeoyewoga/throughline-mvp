/**
 * Document Agent (deterministic in the MVP).
 * Extracts discrete next-steps + timeframes from synthetic referral and
 * discharge-summary text. In the MVP most tasks arrive pre-structured as
 * `task_expected` events; this module adds light parsing of free text so the
 * evidence panel can quote the exact sentence a task came from.
 *
 * Output is a candidate for human confirmation when confidence is low — it never
 * acts on its own.
 */
import type { SourceEvent } from "@/domain/types";

export interface ExtractedTask {
  eventId: string;
  text: string;
  quote: string;
  timeframeHours?: number;
  conditional?: string;
  confidence: "high" | "medium" | "low";
}

const TIMEFRAME_RE = /within\s+(\d+)(?:\s*[–-]\s*(\d+))?\s*(hours?|hrs?|days?|weeks?)/i;

function toHours(value: number, unit: string): number {
  if (/day/i.test(unit)) return value * 24;
  if (/week/i.test(unit)) return value * 24 * 7;
  return value;
}

/** Pull the sentence containing a keyword out of a block of text. */
function sentenceWith(text: string, keyword: RegExp): string | undefined {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.find((s) => keyword.test(s))?.trim();
}

export function extractTasksFromEvent(event: SourceEvent): ExtractedTask[] {
  const out: ExtractedTask[] = [];
  const doc = event.documentText;
  if (!doc) return out;

  // District-nursing / review tasks
  const dnSentence = sentenceWith(doc, /district nurse|re-?dress|dressing|review/i);
  if (dnSentence) {
    const tf = dnSentence.match(TIMEFRAME_RE);
    const timeframeHours = tf ? toHours(Number(tf[2] ?? tf[1]), tf[3]) : undefined;
    const condSentence = sentenceWith(doc, /\bif\b.*(refer|contact|escalate)/i);
    out.push({
      eventId: event.id,
      text: dnSentence.replace(/\s+/g, " "),
      quote: dnSentence.replace(/\s+/g, " "),
      timeframeHours,
      conditional: condSentence?.replace(/\s+/g, " "),
      confidence: timeframeHours ? "high" : "medium",
    });
  }

  return out;
}

/** Best-effort quote of the sentence a structured task_expected event was derived from. */
export function quoteForTask(taskEvent: SourceEvent, sourceEvents: SourceEvent[]): string | undefined {
  const source = sourceEvents.find(
    (e) => e.patientId === taskEvent.patientId && e.documentText && e.pathway === taskEvent.pathway,
  );
  if (!source?.documentText) return undefined;
  const kw = /district nurse|dressing|review|refer|follow-?up|contact/i;
  return sentenceWith(source.documentText, kw)?.replace(/\s+/g, " ");
}
