# Code Guidelines — SnackSpot

This document defines the engineering values, secure development rules, and coding
standards for SnackSpot. All contributors are expected to follow these guidelines.

> **Origin.** These guidelines are the SnackSpot translation of a shared engineering
> standard originally written for a Python/Django service. The *values* and *security
> principles* are identical; the *concrete rules* have been mapped to our actual stack:
> a **pnpm monorepo** running **Next.js 15 (App Router) + TypeScript**, **Prisma +
> PostgreSQL/PostGIS**, **Redis**, **MinIO**, and a **BullMQ** worker. Where the original
> said "DRF serializer" we say "Zod schema"; where it said `ruff`/`mypy` we say
> `ESLint`/`tsc`; where it said `make_password` we say `argon2`.

---

## Engineering Values

### Readable code over clever code

Write for humans first. If someone can't understand your code in 6 months, it is a liability.

**Avoid — clever but hard to read:**
```ts
const users = (await prisma.user.findMany()).filter(u => u.isActive && u.email.endsWith('@example.com') && !u.isArchived)
```

**Prefer — readable and maintainable:**
```ts
const activeUsers = await prisma.user.findMany({
  where: {
    isActive: true,
    email: { endsWith: '@example.com' },
    isArchived: false,
  },
})
```

This applies to variable names, function signatures, and architecture decisions. If you
need a comment to explain *what* the code does, the code probably needs to be rewritten.
(Comments that explain *why* — a security trade-off, a non-obvious constraint — are
valuable and encouraged; see the existing comments in `apps/web/lib/api-helpers.ts`.)

### Context before code

Understand the problem before you start typing. Before writing a single line:

- What problem are we solving?
- Who is the user?
- What does success look like?
- Are there edge cases to handle?
- Is there existing code that already does something similar? (Check `apps/web/lib/` and
  `packages/shared/` first — most cross-cutting concerns already have a helper.)

### Early clarification over late rework

If something is unclear, say so now. A 5-minute question today saves a 2-day rewrite next
week. This applies to ambiguous ticket requirements, architectural decisions, and anything
that makes you think *"I think this is what they mean..."*.

### Ownership as a mindset

You own the outcome, not just the ticket. This means:

- Testing your own code (`pnpm --filter web test`, and on a real environment) before
  marking a ticket as done
- Following up when a deployment includes your changes
- Fixing the bug you introduced, not waiting for someone to assign it to you
- Improving code you touch, even if the ticket didn't ask for it

### What we avoid

| Anti-pattern | Why |
|---|---|
| Silent ambiguity | Guessing leads to building the wrong thing |
| Jumping to solutions | Understand before implementing |
| Overengineering | Build what's needed — YAGNI applies |
| Hero culture | Working weekends to fix preventable issues is not a badge of honour |

---

## Secure Development

### Environments

Development, staging, and production must be strictly segregated.

- Never use real production customer data in development or test environments
- Environment-specific secrets (e.g. `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, database
  credentials, `MINIO_SECRET_KEY`) must never be committed to version control
- Use `.env` files locally (see `.env.example`) and environment variables in CI/CD and
  production
- **All environment variables are validated at startup** through a Zod schema
  (`apps/web/lib/env.ts`, `apps/admin/lib/env.ts`). New config must be added there — never
  read `process.env.FOO` directly in feature code.

### Secure-by-design principles

All code must follow these principles:

- **Minimise attack surface area** — expose only what is necessary
- **Principle of least privilege** — grant only the permissions a component needs
  (`requireAuth` / `requireRole` in `apps/web/lib/api-helpers.ts`)
- **Fail securely** — on error, default to denying access, not allowing it
- **Defence in depth** — don't rely on a single security control (we layer Zod validation,
  rate limiting, same-origin checks, body-size limits, and Semgrep SAST)
- **Do not trust services** — validate inputs from external sources, including other
  internal services and the BullMQ queue payloads in `apps/worker`
- **Avoid security by obscurity** — hiding logic is not a security control
- **Fix security issues correctly** — address the root cause, not just the symptom

### Privacy-by-design principles

- Collect only data that is necessary (data minimisation)
- Privacy must be the default — opt-in, not opt-out
- Apply end-to-end protection across the full data lifecycle (e.g. the worker strips EXIF
  GPS metadata from every uploaded photo — see `apps/worker/src/index.ts`)

### Passwords and credentials

- Passwords must **never** be stored in plain text — always use **Argon2id** via
  `apps/web/lib/auth.ts` (`hashPassword` / `verifyPassword`). Never hand-roll hashing.
- All transmission of sensitive data must use HTTPS/TLS. Auth cookies are `httpOnly`,
  `SameSite`, and `Secure` in production (`AUTH_COOKIE_SECURE`).
- Secrets must be loaded from environment variables (via `env.ts`), never hardcoded

### Input validation

- Never trust user input — validate at the **boundary** using **Zod schemas** before
  passing data into business logic. The shared request/response schemas live in
  `packages/shared/src/index.ts`.
- The boundary helpers are `parseBody` and `parseQuery` in `lib/api-helpers.ts`. Route
  handlers must use them; **never** `(await req.json()) as SomeType` — an unchecked cast
  is not validation.
- Once data has passed a Zod schema, downstream service/lib functions may trust its shape.

### Vulnerability management

- Application code is scanned before deployment via **Semgrep SAST** and **`pnpm audit`**
  (see `.github/workflows/ci.yml`), plus **OWASP ZAP DAST** (`.github/workflows/dast.yml`).
  These are the TS equivalents of `bandit` / `pip-audit`.
- Security patches must be applied within **90 days** of discovery for issues that
  materially impact security. Dependabot (`.github/dependabot.yml`) drives remediation PRs.

---

## Code Review & Quality

### Every PR requires a review

- Reviews must be performed by someone other than the author
- Reviewers must check for security issues, not just functionality
- No code is merged without at least one approval
- CI (test, lint, typecheck, build, SAST) must be green before merge

### What reviewers check

| Area | What to look for |
|---|---|
| Functionality | Does it meet the requirements? |
| Regression | Does it introduce unintended side effects? |
| Dependencies | Could defects propagate to dependent code? |
| Security | Does it violate any secure coding principles? |
| Coding standards | Does it follow the conventions in this document? |

### If you spot a security concern

Flag it explicitly in the PR review. Don't silently approve and hope someone else catches it.

---

## TypeScript & Next.js Conventions

### Code style

- All code is **TypeScript** with `strict` mode on (`tsconfig.base.json`). `any` is a
  smell — prefer `unknown` plus a narrowing guard (see `isResponse`, `hasPrismaCode`).
- Lint with **ESLint** (`next/core-web-vitals` + `security` + `no-unsanitized`) and
  type-check with **`tsc --noEmit`**. **Warnings are errors in CI**
  (`next lint --max-warnings 0`). This applies to **every** app and package, not just `web`.
- Format with **Prettier** (`pnpm format`). Formatting is not a matter of taste — run it.
- No `console.log` in committed code. Use the structured **pino** logger (`lib/logger.ts`,
  or the worker's `log`). The one allowed exception — startup env validation before the
  logger exists — is explicitly `eslint-disable`d with a reason (`apps/web/lib/env.ts`).

### Naming

| Element | Convention | Example |
|---|---|---|
| Variables & functions | `camelCase` | `userEmail`, `getUserById` |
| Types, interfaces, classes, React components | `PascalCase` | `AccessTokenPayload`, `ReviewCard` |
| Constants (module-level, fixed) | `UPPER_SNAKE_CASE` | `MAX_PHOTOS_PER_REVIEW`, `CLEANUP_BATCH_SIZE` |
| Files (non-component) | `kebab-case.ts` | `api-helpers.ts`, `badge-service.ts` |
| React component files | `kebab-case.tsx` | `review-card.tsx`, `bottom-nav.tsx` |
| "Private" module helpers | not exported | keep them un-`export`ed rather than prefixing `_` |

### Project structure (pragmatic layering)

The original standard prescribed a strict `views → services → repositories → models`
stack. In Next.js we keep the **same separation of concerns**, mapped to idiomatic layers.
Respect these boundaries:

```
apps/web/
  app/api/v1/**/route.ts   # HTTP layer: auth, parse/validate, status codes, response shape
  lib/*-service.ts         # Business-logic layer: orchestration and rules
  lib/<helper>.ts          # Reusable domain/data helpers (queries, MinIO, redis, …)
  components/              # React UI (presentational + interactive)
  app/**/page.tsx          # Route UI
packages/db/               # Prisma schema, raw SQL migrations, migration runner
packages/shared/           # Zod schemas + shared types (the validation contract)
packages/ui/               # Cross-app presentational components
apps/worker/               # BullMQ background jobs
```

**Rules (translated):**
- **Route handlers are the HTTP layer.** They authenticate, validate input, call into
  `lib/` services/helpers, choose the status code, and shape the response. They should not
  contain large blocks of business logic.
- **Business logic lives in `lib/`.** When a handler grows beyond orchestration — multiple
  domain steps, reused logic, non-trivial rules — extract it into a `lib/*-service.ts` (as
  already done for `badge-service`, `notification-service`, `review-helpers`).
- **Prisma is our data-access layer.** We do **not** add a formal repository layer on top
  of Prisma where it adds no value. Raw SQL is reserved for what Prisma can't express —
  primarily PostGIS spatial queries (`Place.location` is `geography(Point,4326)`); keep
  those `prisma.$queryRaw` calls in a helper, not inlined in three different routes.
- **Zod schemas are the boundary.** They live in `packages/shared` (or co-located
  `*-schema.ts`) and must not import services or hit the database.
- Components are presentational/interactive only — no direct DB or secret access (those
  are server-only modules).

### Error handling

- **Fail securely and never swallow errors silently.** A bare `catch {}` that hides a
  failure is a bug. Either handle the error meaningfully or log it and return a safe
  response via `serverError(context, error)`.
- Don't leak internals to clients. Unexpected errors return a generic message
  (`'Internal server error'` / `'Er is een interne serverfout opgetreden'`); the detail is
  logged server-side with context.
- A genuinely intentional ignore (e.g. best-effort MinIO cleanup of an object that may not
  exist) must say so with a short comment, like `.catch(() => undefined) // object may not exist`.

---

## API Design

### REST conventions

| Method | Purpose | Success status |
|---|---|---|
| `GET` | Read resource(s) | `200 OK` |
| `POST` | Create resource | `201 Created` |
| `PUT` / `PATCH` | Update | `200 OK` |
| `DELETE` | Delete resource | `204 No Content` (or `200` with a body if one is genuinely needed) |

Use the response builders in `lib/api-helpers.ts` — `ok`, `created`, `noContent`, `err` —
rather than hand-building `Response.json(...)` with ad-hoc status codes.

### URL patterns

```
# Good — nouns, plural, versioned, kebab-case
/api/v1/reviews
/api/v1/reviews/5
/api/v1/password-reset

# Bad — verbs in URLs
/api/v1/createReview
/api/v1/registerUser
```

- URLs: `kebab-case` for multi-word segments — `/api/v1/notification-preferences`
- Be consistent — don't mix styles within the same API.

### Response & JSON shapes

SnackSpot has **two deliberately different API styles** — know which app you're in:

- **`apps/web` (public API, `/api/v1/*`)** wraps successful payloads in an envelope:
  `{ "data": ... }` via `ok()` / `created()`. Errors are `{ "error": "...", "details"?: ... }`.
- **`apps/admin` (internal admin API)** returns **bare, route-specific** success shapes
  (e.g. `{ users, pagination }`) that the admin frontend reads directly — **no `{ data }`
  envelope**. Errors still use `{ "error": ... }`, and user-facing messages are in **Dutch**
  to match the admin UI. This is intentional; see the header comment in
  `apps/admin/lib/api-helpers.ts`. Don't "fix" admin to match web.

Within a single response, JSON field naming follows the existing convention of that API —
be consistent; never mix `userId` and `user_id` in the same payload.

### Status codes

| Code | When to use |
|---|---|
| `200` | Successful GET, PUT, PATCH |
| `201` | Successful POST that creates a resource |
| `204` | Successful DELETE with no body |
| `400` | Malformed request (e.g. invalid JSON) |
| `401` | Missing or invalid authentication |
| `403` | Authenticated but not authorised |
| `404` | Resource not found — also use when you don't want to reveal a resource exists |
| `413` | Request body too large |
| `422` | Validation failed (well-formed but semantically invalid — our Zod failures) |
| `429` | Rate limit exceeded |
| `500` | Unhandled server error (should be rare) |

> Use `404` instead of `403` when you don't want to reveal that a resource exists. If
> User A tries to access User B's private data, return `404`.

> **Note on 422 vs 400:** SnackSpot returns **422** for schema/validation failures
> (`validationError`) and reserves **400** for malformed requests (bad JSON, missing
> Origin). Keep that distinction.

### Error response format

```jsonc
// Validation error (422)
{ "error": "Validation error", "details": { "fieldErrors": { "email": ["Required"] } } }

// Not found (404)
{ "error": "Not found" }

// Server error (500) — never expose internals
{ "error": "Internal server error" }
```

### API documentation

Every public endpoint should be discoverable and documented. Until an OpenAPI generator is
wired up, document each route handler with a short header comment stating method, auth
requirement, and response shape. (The Django standard mandated `drf-spectacular` + Swagger;
the Next.js equivalent is a tool such as a route-level OpenAPI/Zod schema generator — adopt
one before the public API surface grows further.)

---

## Testing

- Co-locate unit tests next to the code (`lib/foo.ts` → `lib/foo.test.ts`) or under
  `components/__tests__/`. We use **Vitest** for unit/component tests and **Playwright**
  for E2E (mobile + desktop).
- Tests must pass before a PR can be merged (`pnpm --filter web test`).
- Prefer testing against real behaviour. Don't over-mock; React state updates in component
  tests must be wrapped so there are no `act(...)` warnings.
- Test edge cases: duplicate emails, invalid passwords, missing fields, boundary values,
  rate-limit boundaries, oversized payloads.
- Every app that ships logic should have tests. The worker and admin currently lag here —
  new logic in those packages must come with tests.

### Running tests

```bash
pnpm --filter web test          # unit/component
pnpm --filter web test:e2e      # Playwright E2E
```

---

## Deliberate trade-offs (and what we did *not* do)

> Guidelines serve the application — not the other way around. A rule is worth following
> only when it makes SnackSpot measurably faster, more robust, or more secure (or clearly
> aids transferability). Below are conscious decisions where we *declined* an "obvious"
> improvement, so a new contributor understands the reasoning and doesn't undo it.

- **The admin import/export route keeps `any` casts (no Zod validation).** The standard says
  "validate all external input." Here the endpoint is behind `requireAdmin` and imports
  *our own* export format. Threat model: only an authenticated admin can reach it — if that
  account is compromised, input validation is the least of our problems. Full Zod validation
  of all 18 tables is high-effort, carries real regression risk on a working migration tool,
  and is only verifiable via the `pnpm validate` round-trip (which needs the Docker stack).
  The `any`s are contained to one admin-only file. **Net ROI is poor, so we left it.** Revisit
  only if this route is ever exposed beyond admins.

- **The worker validates env with hand-written helpers, not Zod.** `apps/worker/src/index.ts`
  uses `requireEnv` / `positiveIntFromEnv`, which already fail fast at startup with a clear
  message. Adding Zod there would introduce a dependency to the worker for identical
  behaviour — "use Zod everywhere" as cargo-cult. The web/admin apps use Zod because they
  have many env vars and share schemas; the worker has a handful. **Keep it dependency-free.**

- **Prettier is configured but the repo was not bulk-reformatted in the same change as
  functional fixes.** A repo-wide `prettier --write` touches ~160 files; bundling that with
  bug fixes would bury the meaningful diff and pollute `git blame`. Run `pnpm format` as its
  own standalone commit, then enable `format:check` in CI.

- **The web and admin APIs intentionally use different response shapes** (`{ data }` envelope
  vs. bare objects + Dutch errors). See the API Design section — do not "unify" them.

## The standard we hold

Every piece of code you write should be something you'd be comfortable showing to a new
team member as an example of how we do things here. If it's not, improve it before merging.
