/**
 * OIDC / CIS2 seam.
 *
 * This build ships the demo credential provider (`users.ts`) only. When these
 * env vars are set, `/login` offers "Sign in with NHS CIS2" instead and
 * `/api/auth/start` begins the authorization-code flow; the callback exchanges
 * the code, then mints the same session token from the verified `id_token`
 * claims (`sub`, name) plus the org → place mapping. Implementing the token
 * exchange + JWKS verification is the remaining work — see `docs/ARCHITECTURE.md`.
 */
export function oidcConfig() {
  const issuer = process.env.THROUGHLINE_OIDC_ISSUER;
  const clientId = process.env.THROUGHLINE_OIDC_CLIENT_ID;
  const clientSecret = process.env.THROUGHLINE_OIDC_CLIENT_SECRET;
  const redirectUri = process.env.THROUGHLINE_OIDC_REDIRECT_URI;
  return { issuer, clientId, clientSecret, redirectUri };
}

export function oidcConfigured(): boolean {
  const { issuer, clientId } = oidcConfig();
  return !!issuer && !!clientId;
}
