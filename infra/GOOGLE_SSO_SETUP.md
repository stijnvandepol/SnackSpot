# Google SSO — Go-Live Checklist

How to take "Sign in with Google" live on SnackSpot. The feature is already in
the codebase (merged to `dev`); this covers the configuration + deploy steps.

> **Critical build-time gotcha:** `NEXT_PUBLIC_GOOGLE_ENABLED` is a **build-time**
> variable. Next.js bakes every `NEXT_PUBLIC_*` value into the client bundle
> during `next build` — not when the container starts. If it is set only at
> runtime, the "Continue with Google" button stays hidden. It must be present
> when the image is built. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are
> server-side and may be runtime-only.

---

## 1. Google Cloud Console (one-time)

1. Open https://console.cloud.google.com/apis/credentials (create a project if needed).
2. **OAuth consent screen**: User type **External**, app name "SnackSpot", support
   email, scopes `openid` / `email` / `profile`. Publish it (otherwise only
   test users can sign in).
3. **Create Credentials → OAuth client ID → Web application**.
4. **Authorized redirect URIs** — exact, no trailing slash:
   - Production: `https://snackspot.online/api/v1/auth/google/callback`
   - Local dev (optional): `http://localhost:3000/api/v1/auth/google/callback`
5. Copy the **Client ID** and **Client secret**.

## 2. Environment variables (production `.env`)

```bash
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-secret>
NEXT_PUBLIC_GOOGLE_ENABLED=1          # MUST be present at build time (see gotcha above)
```

Confirm `NEXT_PUBLIC_APP_URL=https://snackspot.online` — it determines both the
redirect URI and where the callback redirects back to. Secure cookies turn on
automatically in production (`NODE_ENV=production`).

## 3. Deploy + migration

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
```

- The custom migration runner auto-applies **`036_google_sso.sql`** (creates the
  `accounts` table + makes `password_hash` nullable). Confirm in the logs:
  `[done]  036_google_sso.sql`.
- Ensure `NEXT_PUBLIC_GOOGLE_ENABLED=1` is in the **build** environment, or the
  button will not render after deploy.

## 4. Verify (the three paths)

1. **New account** — open `https://snackspot.online/auth/login` → "Log in with
   Google" → consent → land logged in on `/`. In the DB: a `users` row with
   `password_hash NULL` + generated username, and an `accounts` row.
2. **Returning user** — log out, Google again → same account, no new rows.
3. **Auto-link** — register a password account with email X; log out; sign in
   with Google whose verified email is X → land logged in; the existing account
   for X gains a linked `accounts` row.

On failure the callback redirects to `…/auth/login?error=<code>`:

| Code | Likely cause |
|---|---|
| `invalid_state` | Redirect-URI mismatch, or the state/PKCE cookie was lost |
| `email_unverified` | Google did not return a verified email (and no existing link) |
| `banned` | The matched user has `banned_at` set |
| `google_unavailable` | `GOOGLE_CLIENT_ID`/`SECRET` not configured on the server |
| `google_failed` | Token exchange / unexpected error (see server logs, context `google-callback`) |

---

## How it works (1-paragraph reference)

Google is an identity source only. The start route (`/api/v1/auth/google`)
generates a `state` + PKCE verifier (stored in short-lived `SameSite=Lax`
httpOnly cookies) and redirects to Google. The callback
(`/api/v1/auth/google/callback`) validates `state`, exchanges the code via
`arctic`, then resolves the identity (login / auto-link / create / reject) and
issues SnackSpot's normal JWT + rotating refresh-token session — the same
`issueSession()` used by password login. The client's `AuthProvider` rehydrates
from the refresh cookie on the redirect to `/`, so no client-side token handling
is needed. Cookie-name constants live in `apps/web/lib/oauth/oauth-cookies.ts`
(App Router route files may only export HTTP handlers).
