# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- Lowercase with hyphens for separators: `badge-service.ts`, `api-helpers.ts`, `rate-limit.ts`
- Test files use `.test.ts` suffix: `auth.test.ts`, `ratings.test.ts`
- React components use PascalCase: `page.tsx`, `layout.tsx`
- API routes follow Next.js convention: `route.ts` for endpoint handlers, `[id]` for dynamic segments

**Functions:**
- camelCase for all function names: `hashRefreshToken()`, `generateTokenFamily()`, `parseQuery()`, `rateLimitIP()`
- Descriptive verb-noun pattern: `buildSetCookie()`, `normalizeAvatarKey()`, `computeOverallRating()`
- Helper functions use verb prefixes: `get*`, `parse*`, `build*`, `require*`, `is*`

**Variables:**
- camelCase for local variables and parameters: `segments`, `lastIndex`, `activitySnapshot`
- UPPER_SNAKE_CASE for constants: `RESET_TOKEN_BYTES`, `JWT_ISSUER`, `USERNAME_MIN`, `MS_PER_DAY`
- Meaningful names reflecting domain concepts: `tokenFamily`, `refreshToken`, `activitySnapshot` (not `data`, `temp`)

**Types:**
- PascalCase for interfaces and types: `AccessTokenPayload`, `RatingInput`, `NormalizedRatings`, `MentionSegment`
- Suffixes indicate type purpose: `Schema` (Zod), `Payload` (JWT/API), `Options` (function options), `Snapshot` (immutable data)
- Union types documented with comments: `type MentionSegment = | { type: 'text'; value: string } | { type: 'mention'; ... }`

## Code Style

**Formatting:**
- No explicit linter/formatter config detected (not using Prettier or ESLint as strict requirements)
- 2-space indentation (observed in all source files)
- Lines generally under 100 characters
- Imports grouped: external packages first, then local imports

**Comment Style:**
- Inline comments document non-obvious logic, especially security-sensitive code:
  - `// Hash is not reversible by inspection`
  - `// If & were escaped last, '&lt;' would become '&amp;lt;'`
  - `// All tokens rotated within the same session share this family`
- Section separators use comment lines with `─` for file organization:
  ```typescript
  // ─── Constants ───────────────────────────────────────────────────────────────
  // ─── Argon2id password hashing ───────────────────────────────────────────────
  ```
- No JSDoc required for simple functions; detailed docstrings used for complex behavior
- Comments placed above code or inline with explanation of "why" not "what"

**Async/Await:**
- Always use async/await over promise chaining
- Sequential operations: `const result = await operation()`
- Parallel operations: `const [a, b, c] = await Promise.all([...])`
- Error-safe operations: `.catch(() => null)` for optional operations

## Import Organization

**Order:**
1. Node.js/built-in modules: `import jwt from 'jsonwebtoken'`, `import { createHash, randomBytes } from 'crypto'`
2. Third-party packages: `import argon2 from 'argon2'`, `import sharp from 'sharp'`
3. Local imports with relative paths: `import { env } from './env'`, `import { prisma } from '@/lib/db'`
4. Type imports (when needed): `import type { NextRequest } from 'next/server'`

**Path Aliases:**
- `@/*` resolves to app root (configured in `tsconfig.json`)
- Use `@/lib/` for utilities: `@/lib/auth`, `@/lib/api-helpers`
- Use `@/` for same-directory relative imports when crossing module boundaries
- Avoid relative paths like `../../../` — use alias instead

## Error Handling

**Patterns:**
- Early returns with null/Response for validation failure:
  ```typescript
  if (isResponse(query)) return query
  const payload = getAuthPayload(req)
  if (!payload) return err('Unauthorized', 401)
  ```
- Promise rejections caught with `.catch()`:
  ```typescript
  const variantStream = await minioClient.getObject(BUCKET, variantKey).catch(() => null)
  if (!variantStream) return new Response('Not found', { status: 404 })
  ```
- Explicit error types in try/catch:
  ```typescript
  try {
    const contentLength = Number.parseInt(contentLengthRaw, 10)
  } catch {
    return err('Invalid JSON body', 400)
  }
  ```
- API errors follow pattern: `err(message: string, status: number, details?: unknown): Response`
- Business logic errors raised as exceptions; API layer catches and logs
- Context logged in errors: `logger.error({ err: error, context }, 'Internal server error')`

## Logging

**Framework:** Pino (`pino` package) configured in `/home/gebruiker/SnackSpot/apps/web/lib/logger.ts`

**Patterns:**
- Central logger instance exported: `export const logger = pino({...})`
- Level defaults to 'debug' in development, 'info' in production (controlled by `LOG_LEVEL` env var)
- Sensitive paths automatically redacted (passwords, tokens, cookies, auth headers)
- Pretty printing enabled in development via `pino-pretty`
- Used for error logging in API routes: `logger.error({ err, context }, 'message')`
- Example: `logger.error({ err: error, context }, 'Internal server error')`

**When NOT to use console:**
- Only allowed in startup validation before logger is available
- Marked with `// eslint-disable-next-line no-console` when used

## Validation

**Framework:** Zod schemas for runtime validation

**Patterns:**
- All incoming data validated via Zod: `CreateReviewSchema`, `PlaceSearchSchema`
- Schemas defined in `@snackspot/shared` package for shared types
- Safe parsing used for API inputs: `schema.safeParse(raw)`
- Validation errors returned as 422 with details:
  ```typescript
  export function validationError(details: unknown): Response {
    return err('Validation error', 422, details)
  }
  ```
- Environment variables validated at startup:
  ```typescript
  const _env = envSchema.safeParse(process.env)
  if (!_env.success) throw new Error(...)
  ```

## Function Design

**Size:**
- Prefer focused functions under 30 lines
- Extract helpers for complex operations: `normalizeAvatarKey()`, `streamToBuffer()`, `progressForCriteria()`

**Parameters:**
- Limit parameters to 3-4; use options objects for more:
  ```typescript
  export async function recalculateUserBadges(userId: string, options?: RecalculateOptions): Promise<void>
  ```
- Type imports/params explicitly: `req: NextRequest`, `schema: { safeParse(...) }`

**Return Values:**
- Return type explicitly annotated: `Promise<AccessTokenPayload>`, `string | null`, `Response | T`
- Union returns for error handling: `AccessTokenPayload | Response`
- Null for optional results: `await minioClient.getObject(...).catch(() => null)`

## Module Design

**Exports:**
- Named exports for functions: `export function hashPassword(...)`
- Default exports only for modules with single primary export (rarely used)
- Export interfaces/types alongside functions: `export interface AccessTokenPayload`
- Const exports for constants: `export const REFRESH_COOKIE = 'snackspot_rt'`

**File Structure:**
- One module per semantic concern: `auth.ts`, `ratings.ts`, `badge-service.ts`
- Related types exported from same file: `RatingInput`, `NormalizedRatings` in `ratings.ts`
- Utilities organized by function: `/lib/api-helpers.ts` contains all response builders

**Barrel Files:**
- Shared package uses barrel exports: `@snackspot/shared` exports schemas and types
- Web app imports from shared: `import { CreateReviewSchema } from '@snackspot/shared'`

## Code Organization in Test Files

**Section Headers:**
- Organized with visual comment separators for readability:
  ```typescript
  // ─── generateRefreshToken ─────────────────────────────────────────────────────
  ```
- Groups related test suites logically
- Comments explain "why" tests exist before test blocks

**Type Annotations:**
- Interfaces defined at top of files when needed
- Type guards implemented as pure functions (not requiring mocks):
  ```typescript
  function isTheft(usedAt: Date, now: Date): boolean {
    return now.getTime() - usedAt.getTime() > FIVE_MINUTES_MS
  }
  ```

---

*Convention analysis: 2026-04-06*
