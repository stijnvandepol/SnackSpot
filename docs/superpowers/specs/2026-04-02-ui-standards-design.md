# UI Standards & Best Practices Design

date: 2026-04-02
status: approved

## Overview

Four independent improvement sprints, executed in order. Each produces a separate implementation plan. No functional changes — only performance, structure, accessibility, and navigation UX improvements.

**Priority order:** A → B → C → D

---

## Sprint A — Performance

### A1: Replace raw `<img>` with `next/image`

Raw `<img>` tags bypass Next.js image optimisation (no automatic WebP/AVIF, no responsive srcSet, no built-in lazy loading with placeholder). The app already configures `remotePatterns` and modern formats in `next.config.mjs` — the pipeline is ready, the components just aren't using it.

**Files and strategy:**

| File | Current | Strategy | Reason |
|---|---|---|---|
| `components/review-card.tsx` | `<img src={thumb}>` in a fixed-height div | `<Image fill>` with `sizes` | Parent div has explicit height (`h-64 md:h-72`) |
| `components/top-nav.tsx` | `<img>` for profile avatar | `<Image width={44} height={44}>` | Fixed square, known size |
| `components/image-lightbox.tsx` | `<img>` for thumbnail grid + fullscreen modal | `<Image fill>` for both | Container-relative sizing |
| `app/review/[id]/page.tsx` | `<img>` in photo gallery | `<Image fill>` | Gallery items have defined container height |
| `components/avatar-lightbox.tsx` | `<img>` in avatar lightbox | `<Image fill>` | Full-container display |

All `fill`-based usages require `position: relative` on the parent and explicit dimensions — verify or add where missing.

The `sizes` prop must be set on each `<Image fill>` to prevent the browser downloading unnecessarily large images. Use:
- Review card thumbnail: `sizes="(max-width: 672px) 100vw, 672px"`
- Lightbox fullscreen: `sizes="100vw"`
- Lightbox thumbnails: `sizes="(max-width: 768px) 25vw, 100px"`
- Avatar: `sizes="44px"`

### A2: Add `loading.tsx` per data-heavy route

App Router uses `loading.tsx` files as Suspense boundaries for instant route transitions. Currently no route has one, so navigating between pages shows a blank/stale screen until the client component mounts and fetches data.

**Files to create:**

| File | Skeleton content |
|---|---|
| `app/(app)/loading.tsx` | 4× `card h-56 animate-pulse bg-snack-surface` (matches feed skeleton) |
| `app/(app)/profile/loading.tsx` | Profile header skeleton + 3× card skeleton |
| `app/place/[id]/loading.tsx` | Place header skeleton + 3× review card skeleton |

Use only existing `card`, `animate-pulse`, `bg-snack-surface` classes — no new styles needed.

---

## Sprint B — UI Structure

### B1: Fix missing semantic `<h1>` tags

Two pages break the heading hierarchy:

**`app/(app)/profile/page.tsx`**
Add `<h1 className="sr-only">My profile</h1>` at the top of the `ProfileContent` component — visually hidden but present for screen readers and document outline. The tab UI remains unchanged.

**`app/review/[id]/page.tsx`**
The `<h1>` is currently conditional on `dishName`. Add fallback to place name:
```tsx
<h1>{review.dishName ?? review.place.name}</h1>
```

### B2: Standardise section headings

Introduce a consistent `<h2>` style for sub-section headings across place detail and user profile pages. Standard:
```tsx
<h2 className="text-base font-semibold text-snack-text">Section title</h2>
```
Currently used inconsistently: search and nearby pages follow this pattern; place detail and user profile do not.

### B3: Two-column desktop layout for place detail

`app/place/[id]/page.tsx` uses a single column on all screen sizes. On `md:` and above, introduce a two-column grid:
- **Left column (md:w-5/12):** Place info card + map
- **Right column (md:w-7/12):** Reviews list (`PlaceReviewsSection`)

Mobile layout is unchanged (single column, stacked). No changes to the components themselves — only the layout wrapper in `place/[id]/page.tsx`.

```tsx
// Mobile: single column (default)
// Desktop: two-column grid
<div className="md:grid md:grid-cols-12 md:gap-6">
  <div className="md:col-span-5">/* place info + map */</div>
  <div className="md:col-span-7">/* reviews */</div>
</div>
```

---

## Sprint C — Accessibility

### C1: Touch target sizing (WCAG 2.5.5 — 44×44px minimum)

**Bottom nav (`components/bottom-nav.tsx`):**
The `<Link>` inside each `<li>` already fills the full nav height (`h-[4.5rem]` = 72px) but lacks explicit `min-h`. Add `min-h-[44px]` to each link to make the minimum explicit and guard against future regressions.

**Profile avatar in TopNav (`components/top-nav.tsx`):**
Change `h-9 w-9` (36px) to `h-11 w-11` (44px) for the avatar link.

**Feed empty-state CTA (`components/feed-client.tsx`):**
Remove `hidden md:inline-block` from the "Create first post" button — show it on mobile too.

### C2: Fix avatar alt text (`components/avatar-lightbox.tsx`)

Line ~59: change `alt=""` to `alt={\`${username}'s profile picture\`}`.

### C3: Verify focus rings on interactive elements

Audit `bottom-nav.tsx` and `review-interactions.tsx` to confirm all `<button>` and `<Link>` elements inherit the global `:focus-visible` ring from `globals.css`. Add `focus-visible:ring-2 focus-visible:ring-snack-primary focus-visible:ring-offset-2` where missing.

---

## Sprint D — Navigation Context (Hybrid)

### D1: `<Breadcrumb />` component (desktop only)

Create `components/breadcrumb.tsx` — a new client component visible only at `md:` and above.

**Props:**
```tsx
interface BreadcrumbProps {
  items: Array<{ label: string; href?: string }>
}
```

The last item has no `href` (current page). All others are links. Renders as:
```
Explore › Café Roma › Snack review
```

Styling: `text-xs text-snack-muted` with `›` separator, `hover:text-snack-text` on links. Hidden on mobile via `hidden md:flex`.

**Integration points:**

| Page | Breadcrumb trail | Source of data |
|---|---|---|
| `app/place/[id]/page.tsx` | `Explore › {place.name}` | `from` param or default |
| `app/review/[id]/page.tsx` | `{place.name} › Review` | Review data |
| `app/u/[username]/page.tsx` | `Feed › @{username}` | Route param |

### D2: Consistent back-button on mobile

On the three pages above (`place/[id]`, `review/[id]`, `u/[username]`), ensure a `← Back` link is always visible on mobile when a `from` context exists. Fallback href when no `from`:
- Place detail → `/search`
- Review detail → `/` (feed)
- User profile → `/` (feed)

The existing back-button pattern already does this on `place/[id]` — standardise to the same pattern across all three.

---

## What Is NOT Changing

- API routes
- Auth flow
- Theme system
- Component logic (only layout/rendering)
- `add-review/page.tsx` and `profile/page.tsx` internals
- Any existing Tailwind design tokens

---

## Implementation Order

Each sprint is independent. Execute in sequence:

1. **Sprint A** — Performance (highest user impact on mobile)
2. **Sprint B** — UI Structure (SEO + developer clarity)
3. **Sprint C** — Accessibility (WCAG compliance)
4. **Sprint D** — Navigation (UX polish)

Each sprint gets its own implementation plan via `writing-plans`.

---

## Verification Checklist (per sprint)

**Sprint A:**
- [ ] All 5 `<img>` tags replaced with `<Image>`
- [ ] No layout shift on review cards (LCP image loads without CLS)
- [ ] `loading.tsx` files show skeleton on route navigation
- [ ] TypeScript build passes

**Sprint B:**
- [ ] `profile/page.tsx` has `<h1>` in DOM (check DevTools)
- [ ] `review/[id]/page.tsx` always has a visible `<h1>`
- [ ] Place detail shows two-column on `md:`, single column on mobile
- [ ] TypeScript build passes

**Sprint C:**
- [ ] Profile avatar in TopNav is 44×44px
- [ ] Feed empty-state CTA visible on mobile
- [ ] Avatar alt text describes the image
- [ ] All interactive elements show focus ring on keyboard navigation

**Sprint D:**
- [ ] Breadcrumbs visible on desktop for place, review, user profile pages
- [ ] Breadcrumbs hidden on mobile
- [ ] Back-button always present on mobile for those three pages
- [ ] TypeScript build passes
