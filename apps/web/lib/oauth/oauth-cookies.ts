/** Names of the short-lived cookies that carry the OAuth `state` and PKCE
 *  code-verifier across the redirect to Google and back. Kept out of the route
 *  modules because Next.js App Router route files may only export HTTP handlers
 *  (any other export fails `next build`'s route-type validation). */
export const OAUTH_STATE_COOKIE = 'snackspot_oauth_state'
export const OAUTH_VERIFIER_COOKIE = 'snackspot_oauth_verifier'
