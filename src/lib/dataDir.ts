/**
 * Where the JSON store writes. Local dev uses `.data/` in the project; a
 * serverless host (Netlify / Vercel / Lambda) only has a writable `/tmp`, which
 * is per-instance and cleared on cold start. That is acceptable for the demo —
 * state persists while an instance is warm and otherwise re-seeds from the
 * synthetic world. `THROUGHLINE_DATA_DIR` overrides both.
 */
import path from "node:path";

export function dataDir(): string {
  if (process.env.THROUGHLINE_DATA_DIR) return process.env.THROUGHLINE_DATA_DIR;
  if (process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "throughline-data");
  }
  return path.join(process.cwd(), ".data");
}

/** True when the store lives on an ephemeral filesystem (state can reset). */
export function onEphemeralFs(): boolean {
  return (
    !!process.env.NETLIFY ||
    !!process.env.VERCEL ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.THROUGHLINE_DATA_DIR?.startsWith("/tmp")
  );
}
