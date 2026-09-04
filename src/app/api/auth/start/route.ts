import { NextResponse } from "next/server";
import { oidcConfig, oidcConfigured } from "@/lib/auth/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Begin the OIDC authorization-code flow. Only reachable when an issuer is
 * configured; otherwise this build uses the demo credential provider at
 * `/api/auth/login`.
 */
export async function GET(req: Request) {
  if (!oidcConfigured()) {
    return NextResponse.json(
      {
        error: "oidc_not_configured",
        detail:
          "Set THROUGHLINE_OIDC_ISSUER / _CLIENT_ID / _CLIENT_SECRET / _REDIRECT_URI. This build ships the demo credential provider only.",
      },
      { status: 501 },
    );
  }

  const { issuer, clientId, redirectUri } = oidcConfig();
  const next = new URL(req.url).searchParams.get("next") || "/queue";
  const authorize = new URL(`${issuer!.replace(/\/$/, "")}/authorize`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId!);
  authorize.searchParams.set("redirect_uri", redirectUri || new URL("/api/auth/callback", req.url).toString());
  authorize.searchParams.set("scope", "openid profile");
  authorize.searchParams.set("state", Buffer.from(JSON.stringify({ next })).toString("base64url"));
  // NB: the /api/auth/callback code exchange + id_token (JWKS) verification is
  // the remaining work before this path can be enabled — see docs/ARCHITECTURE.md.
  return NextResponse.redirect(authorize);
}
