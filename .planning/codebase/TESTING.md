# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Runner:**
- Vitest 2.1.9
- Config: `/home/gebruiker/SnackSpot/apps/web/vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect()` (imported from `vitest`)

**Run Commands:**
```bash
npm test                  # Run all tests (pnpm test via workspace)
npm run test:watch       # Watch mode (if configured)
npm run test:coverage    # Coverage report
```

**Coverage Configuration:**
- Provider: v8
- Reporters: text, lcov
- Thresholds enforced: 80% lines, 80% functions, 80% branches
- Configured in `vitest.config.ts` under `test.coverage`

## Test File Organization

**Location:**
- Co-located with source files: `lib/auth.ts` paired with `lib/auth.test.ts`
- Same directory structure as implementation

**Naming:**
- Pattern: `{module}.test.ts`
- Examples: `auth.test.ts`, `ratings.test.ts`, `html.test.ts`, `upload.test.ts`

**Discovery:**
- All `*.test.ts` files automatically discovered by Vitest
- Matches glob: `/home/gebruiker/SnackSpot/apps/web/lib/*.test.ts`

## Test Structure

**Suite Organization:**

```typescript
import { describe, expect, it } from 'vitest'
import { functionUnderTest } from '@/lib/module'

describe('functionName', () => {
  it('does something specific', () => {
    expect(result).toEqual(expected)
  })

  it('handles edge case', () => {
    expect(result).toBe(true)
  })
})
```

**Patterns:**
- One primary `describe()` block per function/component
- Nested `describe()` for related behavior grouping:
  ```typescript
  describe('rate limit key format — IP-based', () => { ... })
  describe('rate limit key format — user-based', () => { ... })
  describe('rate limit key format — account login (F1-A)', () => { ... })
  ```
- Each `it()` test covers one assertion or related assertions
- Test names are imperative sentences: "returns...", "accepts...", "rejects...", "handles..."

**Setup/Teardown:**
- No shared setup observed; each test is isolated
- `afterEach()` used for cleanup when needed (e.g., stub globals):
  ```typescript
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  ```

**Assertion Pattern:**
```typescript
it('accepts valid ratings object', () => {
  const parsed = CreateReviewSchema.safeParse({
    placeId: 'place_1',
    ratings: { taste: 5, value: 4, portion: 4, service: null },
    text: 'Very good meal',
    photoIds: ['photo_1'],
  })
  expect(parsed.success).toBe(true)
})
```

## Mocking

**Framework:** Vitest (`vi.*` utilities)

**Patterns:**

Stubbing global objects:
```typescript
vi.stubGlobal('window', {
  location: {
    href: 'https://app.snackspot.com/',
    origin: 'https://app.snackspot.com',
  },
})
afterEach(() => {
  vi.unstubAllGlobals()
})
```

**What to Mock:**
- Browser globals (`window`, `document`) when testing client-side logic
- Global stubs for environment-specific behavior
- External service calls (when behavior can't be tested with real services)

**What NOT to Mock:**
- Pure functions (test real behavior)
- Zod schemas (test actual parsing, not mock)
- Business logic utilities (test deterministic computation)
- Database models or ORM methods (test through `safeParse` validation)

**Example of NOT mocking (preferred):**
```typescript
// Test real Zod behavior, not a mock
const parsed = CreateReviewSchema.safeParse({
  placeId: 'place_1',
  ratings: { taste: 5, value: 4, portion: 4, service: null },
  text: 'Very good meal and fast service',
  photoIds: ['photo_1'],
})
expect(parsed.success).toBe(true)
```

## Test Data and Fixtures

**Helpers in Tests:**

Test helper functions defined in-file for setup:
```typescript
function makeBuffer(patches: Record<number, number>): Buffer {
  const buf = Buffer.alloc(16, 0x00)
  for (const [offset, value] of Object.entries(patches)) {
    buf[Number(offset)] = value
  }
  return buf
}

const JPEG_HEADER = { 0: 0xFF, 1: 0xD8, 2: 0xFF }
const PNG_HEADER = { 0: 0x89, 1: 0x50, 2: 0x4E, 3: 0x47 }
```

**Constants Defined at Top:**
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FIVE_MINUTES_MS = 5 * 60 * 1000
const WINDOW = 10 * 60 * 1000
const NOW = Date.now()
```

**Location:**
- Fixtures and helpers stay in-file, no separate fixture files
- Snapshots defined as constants for reuse across test cases
- Data builders used for complex objects

## Test Types

**Unit Tests (Primary):**
- Test pure functions in isolation: `auth.test.ts`, `ratings.test.ts`, `html.test.ts`
- Test validation schemas: `review-schema.test.ts`
- Test utility functions: `badge-service.test.ts`, `mentions.test.ts`
- Scope: Single function, all code paths, edge cases

**Validation Tests:**
- Test Zod schema parsing: `CreateReviewSchema.safeParse(...)`
- Test both success and failure cases
- Verify error detection for invalid inputs

**Integration Tests:**
- None detected in test files
- Would test API routes with mocked services (not implemented yet)
- Would test database interactions (not unit-tested currently)

**E2E Tests:**
- Not detected in codebase
- No Playwright, Cypress, or similar test runner configured

## Common Patterns

**Testing Deterministic Functions:**
```typescript
it('returns a different value on every call', () => {
  const tokens = Array.from({ length: 20 }, generateRefreshToken)
  const unique = new Set(tokens)
  expect(unique.size).toBe(20)
})

it('is deterministic — same input always produces the same hash', () => {
  const token = generateRefreshToken()
  expect(hashRefreshToken(token)).toBe(hashRefreshToken(token))
})
```

**Testing Edge Cases:**
```typescript
it('rejects a buffer shorter than the signature (2 bytes)', () => {
  expect(matchesMagicBytes('image/jpeg', Buffer.from([0xFF, 0xD8]))).toBe(false)
})

it('does not count expired entries outside the window', () => {
  const expired = NOW - WINDOW - 1
  const result = slidingWindow([expired, expired, expired, expired, expired], NOW, WINDOW, 5)
  expect(result.allowed).toBe(true)
})
```

**Testing Security Properties:**
```typescript
describe('escapeHtml', () => {
  it('neutralises a basic XSS script tag', () => {
    const input = '<script>alert("xss")</script>'
    const output = escapeHtml(input)
    expect(output).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(output).not.toContain('<script>')
  })

  it('escapes & first so subsequent replacements are not double-escaped', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('<b>text</b>')).toBe('&lt;b&gt;text&lt;/b&gt;')
  })
})
```

**Testing Schema Validation:**
```typescript
describe('CreateReviewSchema structured ratings', () => {
  it('accepts ratings object', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      ratings: { taste: 5, value: 4, portion: 4, service: null },
      text: 'Very good meal and fast service',
      photoIds: ['photo_1'],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects out-of-range rating values', () => {
    const parsed = CreateReviewSchema.safeParse({
      placeId: 'place_1',
      ratings: { taste: 0, value: 4, portion: 4, service: null },
      text: 'Very good meal and fast service',
      photoIds: ['photo_1'],
    })
    expect(parsed.success).toBe(false)
  })
})
```

**Testing Async Functions:**
- Not heavily tested in current suite (mostly pure/sync functions)
- Pattern when async needed: Use `async/await` in test:
  ```typescript
  it('handles async operation', async () => {
    const result = await asyncFunction()
    expect(result).toBe(expected)
  })
  ```

**Testing Conditional Logic (Slidable Window Example):**
```typescript
describe('sliding window — conceptual logic', () => {
  function slidingWindow(
    existing: number[],
    now: number,
    windowMs: number,
    limit: number,
  ): { allowed: boolean; count: number } {
    const valid = existing.filter((t) => t > now - windowMs)
    if (valid.length < limit) {
      return { allowed: true, count: valid.length + 1 }
    }
    return { allowed: false, count: valid.length }
  }

  it('allows the first request when the window is empty', () => {
    const result = slidingWindow([], NOW, WINDOW, 5)
    expect(result.allowed).toBe(true)
    expect(result.count).toBe(1)
  })
})
```

## Coverage Measurement

**Current Setup:**
- Threshold: 80% for lines, functions, branches
- Provider: v8 (built into Node.js)
- Reporters: text (console), lcov (for CI/coverage tools)

**Viewing Coverage:**
```bash
npm test -- --coverage
# or configured as npm run test:coverage
```

**Current Coverage Status:**
- Not all files covered equally
- Files with tests: `lib/auth.ts`, `lib/ratings.ts`, `lib/badge-service.ts`, `lib/html.ts`, `lib/mentions.ts`, `lib/upload.ts`, `lib/rate-limit.ts`, `lib/turnstile.ts`, `lib/magic-bytes.ts`, `lib/review-schema.ts`
- API routes and React components not unit-tested (not in current test suite)

## Best Practices Observed

1. **Isolate what you test** - Don't mock core logic; test real behavior
2. **Group related tests** - Use descriptive `describe()` blocks with section comments
3. **One assertion per line** - Each `expect()` should verify one condition
4. **Test behavior, not implementation** - Test "what it does" not "how it does it"
5. **Include negative cases** - Test both success and failure paths
6. **Security-first** - Tests for XSS, validation bypass, edge cases in auth
7. **Pure functions first** - Extract testable pure functions from complex logic
8. **Comment non-obvious tests** - Explain "why" tests exist, especially security tests

---

*Testing analysis: 2026-04-06*
