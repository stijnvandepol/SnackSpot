# Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix dark mode colour bugs, set light as default theme, deduplicate the logo SVG, rename one misnamed file, and add clarifying comments for the next developer — without changing any functionality.

**Architecture:** Five independent change sets applied in order. Each task is self-contained and safe to commit on its own. No new dependencies. No structural changes to large page files.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS (class-based dark mode), Vitest (lib tests only — no component tests exist)

**Run tests with:** `pnpm --filter web test`
**Type-check with:** `pnpm --filter web build`

---

### Task 1: Extract `<SnackSpotLogo />` component

The logo SVG is copy-pasted verbatim in three files. Extract it to a shared component.

**Files:**
- Create: `apps/web/components/snack-spot-logo.tsx`
- Modify: `apps/web/components/top-nav.tsx`
- Modify: `apps/web/app/(app)/layout.tsx`
- Modify: `apps/web/app/auth/login/page.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/components/snack-spot-logo.tsx`:

```tsx
interface SnackSpotLogoProps {
  /** Tailwind class(es) controlling text size, e.g. "text-xl" or "text-2xl" */
  className?: string
}

/**
 * SnackSpot wordmark with the pin-drop "o" glyph.
 * Uses `text-snack-primary` and `text-snack-accent` — both theme-aware tokens.
 * Render at any size by passing a `text-*` Tailwind class via `className`.
 */
export function SnackSpotLogo({ className }: SnackSpotLogoProps) {
  return (
    <span className={`font-heading font-bold leading-none ${className ?? ''}`}>
      <span className="text-snack-primary">Snack</span>
      <span className="text-snack-accent inline-flex items-center">
        Sp
        <span className="inline-flex h-[0.95em] w-[0.75em] items-center justify-center align-middle">
          <svg viewBox="0 0 16 20" fill="none" className="h-[0.95em] w-[0.75em]" aria-hidden="true">
            <path d="M8 19c2.6-3.5 6-7.5 6-11a6 6 0 1 0-12 0c0 3.5 3.4 7.5 6 11Z" fill="currentColor"/>
            <circle cx="8" cy="8" r="2.25" fill="white"/>
          </svg>
        </span>
        t
      </span>
    </span>
  )
}
```

- [ ] **Step 2: Replace logo in `top-nav.tsx`**

Add import at top of file:
```tsx
import { SnackSpotLogo } from './snack-spot-logo'
```

Replace the `<Link href="/">` block that contains the full logo markup (lines ~22–34) with:
```tsx
<Link href="/" aria-label="SnackSpot home">
  <SnackSpotLogo className="text-xl" />
</Link>
```

- [ ] **Step 3: Replace logo in `(app)/layout.tsx`**

Add import:
```tsx
import { SnackSpotLogo } from '@/components/snack-spot-logo'
```

Replace the mobile brand bar `<Link href="/">` logo block (lines ~22–35) with:
```tsx
<Link href="/" aria-label="SnackSpot home">
  <SnackSpotLogo className="text-xl" />
</Link>
```

- [ ] **Step 4: Replace logo in `auth/login/page.tsx`**

Add import:
```tsx
import { SnackSpotLogo } from '@/components/snack-spot-logo'
```

Replace the `<div className="mb-3 text-2xl font-heading font-bold">` block (lines ~31–44) with:
```tsx
<SnackSpotLogo className="mb-3 text-2xl" />
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep -E "error TS" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/snack-spot-logo.tsx \
        apps/web/components/top-nav.tsx \
        "apps/web/app/(app)/layout.tsx" \
        apps/web/app/auth/login/page.tsx
git commit -m "refactor: extract SnackSpotLogo component — was duplicated in 3 files"
```

---

### Task 2: Fix dark mode colour bugs

Four locations use hardcoded colours that don't adapt to the theme.

**Files:**
- Modify: `apps/web/components/review-card.tsx`
- Modify: `apps/web/app/auth/login/page.tsx`
- Modify: `apps/web/components/feed-client.tsx`

- [ ] **Step 1: Fix empty stars in `review-card.tsx`**

Find the `Stars` component (~line 42). Change the empty-star span:

```tsx
// Before
<span className="text-[#e0e0e0]">{'★'.repeat(5 - rating)}</span>

// After — uses theme border token, visible in both light and dark
<span className="text-snack-border">{'★'.repeat(5 - rating)}</span>
```

- [ ] **Step 2: Fix tag badge background in `review-card.tsx`**

Find the tag badge span (~line 119):

```tsx
// Before
className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-snack-primary shadow-sm"

// After — surface token adapts to dark mode
className="rounded-full bg-snack-surface/90 px-2 py-1 text-[11px] font-medium text-snack-primary shadow-sm"
```

- [ ] **Step 3: Fix login background gradient in `login/page.tsx`**

Find the outer div (~line 29):

```tsx
// Before
className="min-h-screen bg-gradient-to-b from-snack-surface to-white flex items-center justify-center px-4"

// After — to-snack-bg is white in light mode, dark slate in dark mode
className="min-h-screen bg-gradient-to-b from-snack-surface to-snack-bg flex items-center justify-center px-4"
```

- [ ] **Step 4: Fix error card in `feed-client.tsx`**

Find the error card div (~line 104):

```tsx
// Before
<div className="card p-4 mb-4 border-red-200 bg-red-50/50" role="status" aria-live="polite">
  <p className="text-sm text-red-700">{error}</p>

// After — dark: variants keep the card readable in dark mode
<div className="card p-4 mb-4 border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30" role="status" aria-live="polite">
  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep -E "error TS" | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/review-card.tsx \
        apps/web/app/auth/login/page.tsx \
        apps/web/components/feed-client.tsx
git commit -m "fix: correct hardcoded colours that broke dark mode"
```

---

### Task 3: Set light mode as default

Currently, users with no stored preference who have a dark OS will see dark mode. Change the default to always be light.

**Files:**
- Modify: `apps/web/components/theme-provider.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Update `getStoredTheme` fallback**

In `apps/web/components/theme-provider.tsx`, find `getStoredTheme` (~line 26):

```tsx
// Before — falls back to 'system', which can resolve to dark
function getStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

// After — no stored preference → always light
function getStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'light'
}
```

- [ ] **Step 2: Update the FOUC-prevention inline script in `layout.tsx`**

In `apps/web/app/layout.tsx`, find the first `<script>` tag in `<head>` (~line 122).
It currently contains a JS string that activates dark mode if `t !== 'light'` and OS is dark.

Change the `__html` value so that dark mode only activates when `t === 'dark'` (explicit opt-in):

```
Before JS string logic:
  var d = t==='dark' || (t!=='light' && matchMedia('(prefers-color-scheme:dark)').matches)

After JS string logic:
  if (t==='dark') document.documentElement.classList.add('dark')
```

Full replacement value for `__html`:
```
(function(){try{var t=localStorage.getItem('snackspot-theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()
```

> Note: This script runs synchronously before React hydrates to prevent a flash of the wrong theme (FOUC). It must remain inline — moving it to an external file would make it async and defeat its purpose.

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep -E "error TS" | head -20
```

Expected: no errors.

- [ ] **Step 4: Manual behaviour check**

Open the app in a browser:
1. `localStorage.clear()` in DevTools console → reload → should show **light mode**
2. Profile → Settings → select Dark → reload → should show **dark mode**
3. Profile → Settings → select System → reload → should follow OS preference
4. Profile → Settings → select Light → reload → should show **light mode**

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/theme-provider.tsx \
        apps/web/app/layout.tsx
git commit -m "feat: default to light mode when no theme preference is stored"
```

---

### Task 4: Rename `RelatedGuides.tsx` to `related-guides.tsx`

`components/RelatedGuides.tsx` is the only PascalCase filename in `components/`. All others use kebab-case. This causes confusion for developers following the established convention.

**Files:**
- Rename: `apps/web/components/RelatedGuides.tsx` → `apps/web/components/related-guides.tsx`
- Modify (imports): 6 files in `apps/web/app/guides/`

- [ ] **Step 1: Rename via git**

```bash
cd apps/web
git mv components/RelatedGuides.tsx components/related-guides.tsx
```

- [ ] **Step 2: Update all 6 imports**

```bash
cd apps/web
sed -i "s|@/components/RelatedGuides|@/components/related-guides|g" \
  app/guides/add-snackspot-to-home-screen/page.tsx \
  app/guides/how-to-add-a-place/page.tsx \
  app/guides/how-to-change-your-password/page.tsx \
  app/guides/how-to-create-an-account/page.tsx \
  app/guides/how-to-delete-your-account/page.tsx \
  app/guides/how-to-post-a-review/page.tsx
```

- [ ] **Step 3: Verify no remaining references to old path**

```bash
cd apps/web && grep -r "components/RelatedGuides" . --include="*.tsx" --include="*.ts"
```

Expected: no output (zero matches).

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep -E "error TS" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename RelatedGuides.tsx to related-guides.tsx (kebab-case convention)"
```

---

### Task 5: Add readability comments

Three locations contain non-obvious logic. Short comments explain the *why* so the next developer doesn't have to reverse-engineer it.

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/components/auth-provider.tsx`
- Modify: `apps/web/components/feed-client.tsx`

- [ ] **Step 1: Comment the FOUC script in `layout.tsx`**

The inline script from Task 3 should have a comment. Verify the script tag reads:

```tsx
{/* Runs synchronously before React hydrates to prevent a flash of the wrong theme
    (FOUC). Must stay inline — an external script would load async and fire too late. */}
<script ... />
```

If the comment is missing, add it as a JSX comment immediately above the `<script>` tag.

- [ ] **Step 2: Comment the 401 retry block in `auth-provider.tsx`**

In `apps/web/components/auth-provider.tsx`, find the `if (res.status === 401)` block (~line 64). Add the comment on the line above it:

```tsx
        // Token-rotation race: two tabs can refresh simultaneously. The second
        // request arrives after the first already rotated the cookie, so it gets
        // a 401. One retry after a short delay is enough to recover.
        if (res.status === 401) {
```

- [ ] **Step 3: Comment the dedup refs in `feed-client.tsx`**

In `apps/web/components/feed-client.tsx`, find `inFlightRef` and `requestedCursorsRef` (~lines 30–31). Add the comment block immediately above them:

```tsx
  // Two refs prevent duplicate fetches:
  // - inFlightRef blocks a second call while one is already in progress
  // - requestedCursorsRef prevents re-fetching a cursor we already requested,
  //   even after inFlightRef resets between React renders
  const inFlightRef = useRef(false)
  const requestedCursorsRef = useRef<Set<string>>(new Set())
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep -E "error TS" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/layout.tsx \
        apps/web/components/auth-provider.tsx \
        apps/web/components/feed-client.tsx
git commit -m "docs: add clarifying comments to non-obvious logic"
```

---

### Task 6: Final verification

Read-only. Run through the complete checklist before calling the refactor done.

- [ ] **Step 1: Run lib tests**

```bash
pnpm --filter web test
```

Expected: all tests pass.

- [ ] **Step 2: Full production build**

```bash
pnpm --filter web build
```

Expected: exits 0, no errors.

- [ ] **Step 3: Theme behaviour (manual)**

Open the running app:
1. `localStorage.clear()` → reload → light mode ✓
2. Settings → Dark → reload → dark mode ✓
3. Settings → System → reload → follows OS ✓
4. Settings → Light → reload → light mode ✓

- [ ] **Step 4: Dark mode visuals (manual)**

Switch to dark mode and check:
- [ ] Empty stars on review cards are visible (light grey, not invisible)
- [ ] Tag badges on review card photos are readable
- [ ] Login page has a dark gradient, not ending in white
- [ ] Feed error card is readable (trigger: go offline and scroll to bottom)

- [ ] **Step 5: Logo in all three locations (manual)**

- [ ] Desktop nav (≥768 px wide)
- [ ] Mobile brand bar (≤767 px wide)
- [ ] Login/register pages

- [ ] **Step 6: Guides pages (manual)**

Navigate to `/guides/how-to-post-a-review` — RelatedGuides section must render at the bottom.
