# Sprint D — Navigation Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visual breadcrumbs on desktop for place, review, and user profile pages, and ensure a consistent back-button is always visible on mobile for those same three pages.

**Architecture:** A new `<Breadcrumb />` client component renders only at `md:` breakpoint. It accepts a flat array of `{ label, href? }` items and renders a simple trail with `›` separators. Each page constructs its own trail from available data (route params, `from` query param). The back-button pattern already exists on place and review pages — standardised to the same component across all three pages.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS

**Run type-check with:** `cd apps/web && pnpm build 2>&1 | grep "error TS"`

---

### Task 1: Create the `<Breadcrumb />` component

**Files:**
- Create: `apps/web/components/breadcrumb.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/components/breadcrumb.tsx`:

```tsx
import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

/**
 * Desktop-only breadcrumb trail. Hidden on mobile (md: breakpoint).
 * Last item has no href (current page). All others are links.
 * Example: [{ label: 'Explore', href: '/search' }, { label: 'Café Roma' }]
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-xs text-snack-muted mb-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden="true">›</span>}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-snack-text transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-snack-text font-medium' : ''}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/breadcrumb.tsx
git commit -m "feat: add Breadcrumb component for desktop navigation context"
```

---

### Task 2: Add breadcrumbs to Place detail page

**Files:**
- Modify: `apps/web/app/place/[id]/page.tsx`

The `from` param tells us where the user came from (`search`, `nearby`, `feed`, `profile`, `user:username`). Use it to build the trail.

- [ ] **Step 1: Add import**

In `apps/web/app/place/[id]/page.tsx`, add:
```tsx
import { Breadcrumb } from '@/components/breadcrumb'
```

- [ ] **Step 2: Build the breadcrumb trail**

Add this helper function after `resolveBackHref`:

```tsx
function buildPlaceBreadcrumb(from: string | undefined, placeName: string): Array<{ label: string; href?: string }> {
  const crumbs: Array<{ label: string; href?: string }> = []
  if (from === 'search' || !from) crumbs.push({ label: 'Explore', href: '/search' })
  else if (from === 'nearby') crumbs.push({ label: 'Nearby', href: '/nearby' })
  else if (from === 'feed') crumbs.push({ label: 'Feed', href: '/' })
  else if (from === 'profile') crumbs.push({ label: 'Profile', href: '/profile' })
  else if (from.startsWith('user:')) {
    const username = from.slice('user:'.length)
    crumbs.push({ label: `@${username}`, href: `/u/${encodeURIComponent(username)}` })
  }
  crumbs.push({ label: placeName })
  return crumbs
}
```

- [ ] **Step 3: Render the breadcrumb**

In the page's return, immediately after the JSON-LD script and before the back/write-review buttons, add:

```tsx
<Breadcrumb items={buildPlaceBreadcrumb(from, place.name)} />
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/place/[id]/page.tsx"
git commit -m "feat: add desktop breadcrumb to place detail page"
```

---

### Task 3: Add breadcrumbs to Review detail page

**Files:**
- Modify: `apps/web/app/review/[id]/page.tsx`

The review page knows the place name and has `from` context. The trail is: `origin › place name › Review`.

- [ ] **Step 1: Add import**

In `apps/web/app/review/[id]/page.tsx`, add:
```tsx
import { Breadcrumb } from '@/components/breadcrumb'
```

- [ ] **Step 2: Build the breadcrumb trail**

Add this helper after `parsePlaceContext`:

```tsx
function buildReviewBreadcrumb(
  from: string | undefined,
  placeName: string,
  placeId: string,
  parsedPlaceContext: { placeId: string; origin: string } | null,
): Array<{ label: string; href?: string }> {
  const crumbs: Array<{ label: string; href?: string }> = []

  if (parsedPlaceContext) {
    // Came from a place page — show the place as the parent
    crumbs.push({
      label: placeName,
      href: `/place/${encodeURIComponent(parsedPlaceContext.placeId)}?from=${encodeURIComponent(parsedPlaceContext.origin)}`,
    })
  } else if (from === 'feed' || !from) {
    crumbs.push({ label: 'Feed', href: '/' })
  } else if (from === 'profile') {
    crumbs.push({ label: 'Profile', href: '/profile' })
  } else if (from.startsWith('user:')) {
    const username = from.slice('user:'.length)
    crumbs.push({ label: `@${username}`, href: `/u/${encodeURIComponent(username)}` })
  }

  crumbs.push({ label: 'Review' })
  return crumbs
}
```

- [ ] **Step 3: Render the breadcrumb**

In the return, immediately after the JSON-LD script and before the back-button `<div>`, add:

```tsx
<Breadcrumb items={buildReviewBreadcrumb(from, review.place.name, review.place.id, parsedPlaceContext)} />
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/review/[id]/page.tsx"
git commit -m "feat: add desktop breadcrumb to review detail page"
```

---

### Task 4: Add breadcrumbs to User profile page

**Files:**
- Modify: `apps/web/app/u/[username]/page.tsx`

Simple two-item trail: `Feed › @username`.

- [ ] **Step 1: Add import**

In `apps/web/app/u/[username]/page.tsx`, add:
```tsx
import { Breadcrumb } from '@/components/breadcrumb'
```

- [ ] **Step 2: Render the breadcrumb**

In the return, immediately before the profile card `<div className="card p-6 mb-6 ...">`, add:

```tsx
<Breadcrumb items={[{ label: 'Feed', href: '/' }, { label: `@${user.username}` }]} />
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/u/[username]/page.tsx"
git commit -m "feat: add desktop breadcrumb to user profile page"
```

---

### Task 5: Standardise mobile back-button across all three pages

**Files:**
- Modify: `apps/web/app/place/[id]/page.tsx`
- Modify: `apps/web/app/review/[id]/page.tsx`
- Modify: `apps/web/app/u/[username]/page.tsx`

Place and review pages already have a back-button. User profile does not. Standardise: always render a `← Back` link on mobile that uses the resolved back href.

- [ ] **Step 1: Add back-button to user profile page**

In `apps/web/app/u/[username]/page.tsx`, the page currently has no back-button. Add after the `<Breadcrumb>` (from Task 4):

```tsx
<div className="md:hidden mb-4">
  <Link href="/" className="btn-secondary text-sm">← Back</Link>
</div>
```

(The user profile always returns to Feed on mobile since there's no `from` context on this page.)

- [ ] **Step 2: Verify place and review back-buttons are mobile-visible**

Read `apps/web/app/place/[id]/page.tsx` and `apps/web/app/review/[id]/page.tsx`. Confirm the existing back-button `<div>` does NOT have `hidden md:hidden` or similar classes suppressing it on mobile. If it does, remove that class.

Both currently render:
```tsx
<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
  <Link href={backHref} className="btn-secondary text-sm">Back</Link>
  ...
</div>
```

This is already visible on mobile — no change needed if confirmed. ✓

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/u/[username]/page.tsx"
git commit -m "feat: add mobile back-button to user profile page"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full build**

```bash
cd apps/web && pnpm build 2>&1 | grep -E "error TS|Error" | head -20
```

- [ ] **Step 2: Desktop breadcrumb check (≥768px)**

Navigate to:
- Any place page → breadcrumb shows `Explore › Place Name` (or context-appropriate root) ✓
- Any review page → breadcrumb shows `Place Name › Review` ✓
- Any user profile (`/u/username`) → breadcrumb shows `Feed › @username` ✓

- [ ] **Step 3: Mobile breadcrumb hidden (<768px)**

On mobile width, breadcrumbs must not appear. ✓

- [ ] **Step 4: Mobile back-button**

On mobile, all three pages show a `← Back` / `Back` button. ✓

- [ ] **Step 5: Breadcrumb links work**

Click each breadcrumb link — navigates to the correct page. ✓
