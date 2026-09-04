/**
 * Session tokens — a signed, self-contained identity cookie.
 *
 * `<base64url(payload)>.<base64url(HMAC-SHA256(payload))>`. Uses Web Crypto only
 * (no Node built-ins), so the same code verifies a session in Edge middleware
 * and in Node route handlers. This is NOT an OIDC implementation — it is the
 * seam a real CIS2 / NHS login flow drops its verified claims into
 * (`src/lib/auth/oidc.ts`).
 */

export interface SessionUser {
  /** Stable user id (an OIDC `sub` in production). */
  sub: string;
  name: string;
  role: "coordinator" | "oversight";
  /** Tenant this identity is scoped to. */
  placeId: string;
  /** Home organisation. */
  orgId: string;
}

interface TokenPayload extends SessionUser {
  iat: number;
  exp: number;
}

export const SESSION_COOKIE = "throughline_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * Dev signing secret. A real deployment MUST set `THROUGHLINE_SESSION_SECRET`;
 * with the default in place tokens are still signed, but the key is public.
 */
const DEV_SECRET = "throughline-dev-session-secret-not-for-production";

function secret(): string {
  return process.env.THROUGHLINE_SESSION_SECRET || DEV_SECRET;
}

export function usingDevSessionSecret(): boolean {
  return !process.env.THROUGHLINE_SESSION_SECRET;
}

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(user: SessionUser, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { ...user, iat: now, exp: now + ttlSeconds };
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.indexOf(".") < 0) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = b64urlEncode(
    new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body))),
  );
  if (!timingSafeEqual(sig, expected)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
  if (!payload.sub || !payload.placeId || (payload.role !== "coordinator" && payload.role !== "oversight")) {
    return null;
  }
  return {
    sub: payload.sub,
    name: payload.name,
    role: payload.role,
    placeId: payload.placeId,
    orgId: payload.orgId,
  };
}
