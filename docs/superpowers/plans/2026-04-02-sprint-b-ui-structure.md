# Sprint B — UI Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix missing semantic `<h1>` tags on profile and review detail pages, standardise `<h2>` section headings across place detail and user profile pages, and introduce a two-column desktop layout on the place detail page.

**Architecture:** All changes are in existing page and component files. No new components are created. The two-column layout uses a CSS grid applied only at `md:` breakpoint — mobile layout is untouched. Heading fixes are minimal: one `sr-only` h1, one conditional-fallback h1.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS

**Run type-check with:** `cd apps/web && pnpm build 2>&1 | grep "error TS"`

---

### Task 1: Fix missing `<h1>` on the Profile page

**Files:**
- Modify: `apps/web/app/(app)/profile/page.tsx`

The `ProfileContent` component has no `<h1>`. Screen readers and search engines see the page title from the browser tab but no document-level heading. A visually hidden `<h1>` fixes this without changing the visual design.

- [ ] **Step 1: Find the `ProfileContent` component opening**

Open `apps/web/app/(app)/profile/page.tsx`. Find the `function ProfileContent()` and its return statement's opening `<div>` — it should be around line 70–90.

- [ ] **Step 2: Add the sr-only h1**

Immediately inside the opening `<div>` of `ProfileContent`'s return, before any other content, add:

```tsx
<h1 className="sr-only">My profile</h1>
```

Example — if the return currently opens with:
```tsx
return (
  <div className="mx-auto max-w-2xl px-4 py-6">
    <div className="card p-6 mb-6 ...">
```

It becomes:
```tsx
return (
  <div className="mx-auto max-w-2xl px-4 py-6">
    <h1 className="sr-only">My profile</h1>
    <div className="card p-6 mb-6 ...">
```

- [ ] **Step 3: Verify in DevTools**

Run the dev server and open `/profile`. In DevTools → Elements, confirm `<h1 class="sr-only">My profile</h1>` appears in the DOM.

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(app)/profile/page.tsx"
git commit -m "fix: add sr-only h1 to profile page for semantic heading hierarchy"
```

---

### Task 2: Fix conditional `<h1>` on the Review detail page

**Files:**
- Modify: `apps/web/app/review/[id]/page.tsx`

Currently the `<h1>` only renders when `review.dishName` is set (line ~154):
```tsx
{review.dishName && (
  <h1 className="font-heading font-bold text-lg text-snack-text">{review.dishName}</h1>
)}
```

If there is no dish name, the page has no `<h1>`. Fix: always render `<h1>`, fall back to the place name.

- [ ] **Step 1: Replace the conditional h1**

Find (~line 153):
```tsx
{review.dishName && (
  <h1 className="font-heading font-bold text-lg text-snack-text">{review.dishName}</h1>
)}
<Link href={placeLinkHref} className="text-sm text-snack-primary hover:underline">
  {review.place.name}
```

Replace with:
```tsx
<h1 className="font-heading font-bold text-lg text-snack-text">
  {review.dishName ?? review.place.name}
</h1>
{review.dishName && (
  <Link href={placeLinkHref} className="text-sm text-snack-primary hover:underline">
    {review.place.name}
    {extractCity(review.place.address) && (
      <span className="text-snack-muted font-normal"> · {extractCity(review.place.address)}</span>
    )}
  </Link>
)}
{!review.dishName && (
  <Link href={placeLinkHref} className="text-sm text-snack-primary hover:underline">
    {extractCity(review.place.address) ?? review.place.address}
  </Link>
)}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/review/[id]/page.tsx"
git commit -m "fix: always render h1 on review detail page, fall back to place name"
```

---

### Task 3: Standardise `<h2>` section headings on Place detail and User profile

**Files:**
- Modify: `apps/web/app/place/[id]/page.tsx`
- Modify: `apps/web/app/u/[username]/page.tsx`
- Modify: `apps/web/components/place-reviews-section.tsx`

The standard pattern used on search and nearby pages:
```tsx
<h2 className="text-base font-semibold text-snack-text">Section title</h2>
```

- [ ] **Step 1: Add `<h2>` to place detail**

In `apps/web/app/place/[id]/page.tsx`, above `<PlaceReviewsSection ...>` (~line 125), add:

```tsx
<h2 className="text-base font-semibold text-snack-text mb-3">Reviews</h2>
<PlaceReviewsSection ... />
```

- [ ] **Step 2: Add `<h2>` to user profile reviews section**

Open `apps/web/app/u/[username]/page.tsx`. Find where `<UserReviewsList>` is rendered (around line 80–100). Add a heading above it:

```tsx
<h2 className="text-base font-semibold text-snack-text mb-3">Reviews</h2>
<UserReviewsList username={user.username} />
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/place/[id]/page.tsx" \
        "apps/web/app/u/[username]/page.tsx"
git commit -m "fix: add h2 section headings to place detail and user profile pages"
```

---

### Task 4: Two-column desktop layout on Place detail page

**Files:**
- Modify: `apps/web/app/place/[id]/page.tsx`

On mobile: single column (unchanged). On `md:` and above: place info card + map in left column (5/12), reviews in right column (7/12). The `PlaceMap` component is loaded dynamically — check if it's imported here or inside `PlaceReviewsSection`.

Looking at the current layout in `place/[id]/page.tsx`:
- The page card with place info is a standalone `<div className="card mb-6 p-5">` block
- `PlaceReviewsSection` renders the reviews below it

We wrap both in a responsive grid.

- [ ] **Step 1: Import PlaceMap dynamically**

In `apps/web/app/place/[id]/page.tsx`, add at the top (after existing imports):

```tsx
import dynamic from 'next/dynamic'

const PlaceMap = dynamic(() => import('@/components/ui/map').then(m => m.Map), {
  ssr: false,
  loading: () => <div className="h-48 rounded-xl bg-snack-surface animate-pulse" />,
})
```

- [ ] **Step 2: Wrap the layout in a responsive grid**

Find the outer container (~line 87):
```tsx
return (
  <div className="mx-auto max-w-2xl px-4 py-6">
    <script ... />
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      ...back/write-review buttons...
    </div>

    <div className="card mb-6 p-5">
      ...place info...
    </div>

    <h2 ...>Reviews</h2>
    <PlaceReviewsSection ... />
  </div>
)
```

Replace with:
```tsx
return (
  <div className="mx-auto max-w-5xl px-4 py-6">
    <script ... />
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      ...back/write-review buttons...
    </div>

    <div className="md:grid md:grid-cols-12 md:gap-6 md:items-start">
      {/* Left column: place info + map */}
      <div className="md:col-span-5 mb-6 md:mb-0 space-y-4">
        <div className="card p-5">
          ...place info card contents (unchanged)...
        </div>
        <PlaceMap lat={place.lat} lng={place.lng} placeName={place.name} className="h-48 rounded-xl overflow-hidden" />
      </div>

      {/* Right column: reviews */}
      <div className="md:col-span-7">
        <h2 className="text-base font-semibold text-snack-text mb-3">Reviews</h2>
        <PlaceReviewsSection
          placeId={place.id}
          placeName={place.name}
          placeAddress={place.address}
          from={from}
        />
      </div>
    </div>
  </div>
)
```

> Note: Read `apps/web/components/ui/map.tsx` first to verify the exact component export name and required props before implementing.

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 4: Visual check**

Open a place page at ≥768px width — should show two columns. At <768px — should show single column, map below info.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/place/[id]/page.tsx"
git commit -m "feat: two-column desktop layout for place detail page"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full build**

```bash
cd apps/web && pnpm build 2>&1 | grep -E "error TS|Error" | head -20
```

- [ ] **Step 2: Heading audit (DevTools)**

Check these pages in DevTools → Elements, confirm `<h1>` exists:
- `/profile` — `<h1 class="sr-only">My profile</h1>` in DOM ✓
- `/review/[any-id-without-dish-name]` — `<h1>` contains place name ✓
- `/review/[any-id-with-dish-name]` — `<h1>` contains dish name ✓

- [ ] **Step 3: Place detail layout**

Open any place page:
- Desktop (≥768px): two columns — info/map left, reviews right ✓
- Mobile (<768px): single column — info, then reviews ✓
