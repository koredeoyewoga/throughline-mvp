/**
 * Optional AI explanation adapter.
 *
 * The MVP does NOT require this. Detection, scoring and the recommended action
 * are all produced deterministically. When enabled, a model is used only to
 * *rephrase* the deterministic explanation into plainer language — it is given
 * the already-extracted facts, told never to invent, and instructed to answer
 * "Insufficient information available." if the facts do not support a clear
 * statement.
 *
 * No SDK dependency: a plain fetch to the Anthropic Messages API.
 */

const SYSTEM = `You are a coordination assistant for an NHS place-based care team.
You rephrase an already-completed analysis into two or three short, plain sentences a busy coordinator can read in five seconds.
Rules:
- Use ONLY the facts provided. Never add clinical detail, numbers, names or organisations that are not in the facts.
- Do not give clinical advice and do not change the recommended action.
- If the facts are too thin to explain the problem clearly, reply exactly: Insufficient information available.
- No preamble, no bullet points, no headings. Just the sentences.`;

export interface RephraseInput {
  pattern: string;
  deterministicWhy: string;
  facts: string[];
  recommendedAction: string;
}

export function aiEnabled(): boolean {
  return process.env.THROUGHLINE_AI_EXPLANATIONS === "on" && !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Defence-in-depth filter on model output. Even a well-behaved model can drift;
 * anything that looks like a clinical directive, the "insufficient information"
 * signal, an empty string, or chat preamble is rejected so the caller falls
 * back to the deterministic explanation.
 */
const CLINICAL_DIRECTIVE =
  /\b(prescrib\w*|diagnos\w*|titrat\w*|administ\w*|dispens\w*|do not resuscitate|DNR|section (2|3|136)\b|increase the dose|reduce the dose|start (him|her|them|the patient) on|stop (his|her|their|the) [a-z]+ (medication|dose|tablets))\b/i;
const PREAMBLE = /^(here('| i)s|sure[,.]|certainly[,.]|okay[,.]|i['’]ll |as requested|below is)/i;

export function acceptModelText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (/^insufficient information available\.?$/i.test(text)) return null;
  if (CLINICAL_DIRECTIVE.test(text)) return null;
  if (PREAMBLE.test(text)) return null;
  return text;
}

export async function rephraseExplanation(input: RephraseInput): Promise<string | null> {
  if (!aiEnabled()) return null;
  const model = process.env.THROUGHLINE_AI_MODEL || "claude-sonnet-5";
  const userContent = [
    `Coordination failure pattern: ${input.pattern}`,
    ``,
    `Facts (the only information you may use):`,
    ...input.facts.map((f) => `- ${f}`),
    ``,
    `Draft explanation to rephrase: ${input.deterministicWhy}`,
    `Recommended action (do not change): ${input.recommendedAction}`,
  ].join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 220,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
      // Keep the request from hanging a page render.
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    return acceptModelText(text);
  } catch {
    return null;
  }
}
