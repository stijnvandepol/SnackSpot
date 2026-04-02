# Sprint A — Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw `<img>` tags with Next.js `<Image>` for automatic WebP/AVIF optimisation and responsive sizing, and add `loading.tsx` skeleton files so App Router route transitions show instant feedback instead of a blank screen.

**Architecture:** Next.js `<Image>` uses `fill` mode inside relative-positioned containers for images with unknown dimensions, and explicit `width`/`height` for fixed-size avatars. Lightbox modal images (user-triggered, dynamic size) keep raw `<img>` — the optimisation benefit there is negligible. `loading.tsx` files are pure UI: they export a React component with skeleton markup matching the page's real content shape.

**Tech Stack:** Next.js 15 App Router, `next/image`, TypeScript, Tailwind CSS

**Run type-check with:** `cd apps/web && pnpm build 2>&1 | grep "error TS"`

---

### Task 1: Replace review card thumbnail with `<Image>`

**Files:**
- Modify: `apps/web/components/review-card.tsx`

The thumbnail `<img>` is inside a `relative h-64 w-full md:h-72` div — perfect for `fill` mode.

- [ ] **Step 1: Add import**

At the top of `apps/web/components/review-card.tsx`, add:
```tsx
import Image from 'next/image'
```

- [ ] **Step 2: Replace the `<img>` tag**

Find (~line 75):
```tsx
<div className="relative h-64 w-full bg-snack-surface md:h-72">
  <img
    src={thumb}
    alt={review.dishName ?? 'Review photo'}
    className="h-full w-full object-cover"
    loading={priority ? 'eager' : 'lazy'}
    fetchPriority={priority ? 'high' : 'auto'}
  />
</div>
```

Replace with:
```tsx
<div className="relative h-64 w-full bg-snack-surface md:h-72">
  <Image
    src={thumb}
    alt={review.dishName ?? 'Review photo'}
    fill
    sizes="(max-width: 672px) 100vw, 672px"
    className="object-cover"
    priority={priority}
  />
</div>
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/review-card.tsx
git commit -m "perf: use next/image for review card thumbnail"
```

---

### Task 2: Replace profile avatar in TopNav with `<Image>`

**Files:**
- Modify: `apps/web/components/top-nav.tsx`

The avatar is a fixed 36px circle. We upgrade to 44px (WCAG touch target — this overlaps Sprint C, doing it here is more efficient).

- [ ] **Step 1: Add import**

At the top of `apps/web/components/top-nav.tsx`, add:
```tsx
import Image from 'next/image'
```

- [ ] **Step 2: Replace the `<img>` tag**

Find (~line 61):
```tsx
<Link
  href="/profile"
  aria-label="Open profile"
  className="h-9 w-9 rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-semibold text-sm uppercase"
>
  {user.avatarKey ? (
    <img src={avatarUrl(user.avatarKey) ?? undefined} alt="Profile avatar" className="h-full w-full rounded-full object-cover" />
  ) : (
    user.username[0]
  )}
</Link>
```

Replace with:
```tsx
<Link
  href="/profile"
  aria-label="Open profile"
  className="h-11 w-11 rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-semibold text-sm uppercase overflow-hidden"
>
  {user.avatarKey ? (
    <Image
      src={avatarUrl(user.avatarKey) ?? ''}
      alt="Profile avatar"
      width={44}
      height={44}
      className="rounded-full object-cover"
    />
  ) : (
    user.username[0]
  )}
</Link>
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/top-nav.tsx
git commit -m "perf: use next/image for topnav profile avatar, bump to 44px"
```

---

### Task 3: Replace avatar thumbnail in AvatarLightbox with `<Image>`

**Files:**
- Modify: `apps/web/components/avatar-lightbox.tsx`

The thumbnail trigger button (line ~59) renders inside a rounded container — use `fill`. The fullscreen modal image (line ~82) is user-triggered with dynamic dimensions — keep `<img>` there.

- [ ] **Step 1: Add import**

At the top of `apps/web/components/avatar-lightbox.tsx`, add:
```tsx
import Image from 'next/image'
```

- [ ] **Step 2: Replace the thumbnail `<img>` and fix alt text**

Find (~line 57):
```tsx
{avatar ? (
  <img src={avatar} alt="" className="h-full w-full object-cover" />
) : (
  username[0]
)}
```

Replace with (note: also fixes the empty `alt` — tracked in Sprint C, efficient to fix here):
```tsx
{avatar ? (
  <span className="relative block h-full w-full">
    <Image
      src={avatar}
      alt={`${username}'s profile picture`}
      fill
      sizes="64px"
      className="object-cover"
    />
  </span>
) : (
  username[0]
)}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/avatar-lightbox.tsx
git commit -m "perf: use next/image for avatar thumbnail, fix alt text"
```

---

### Task 4: Replace image lightbox thumbnails with `<Image>`

**Files:**
- Modify: `apps/web/components/image-lightbox.tsx`

The thumbnail grid items each have `aspect-square overflow-hidden` set by the caller via `itemClassName`. The `thumbnailClassName` sets `h-full w-full object-cover`. We add `relative` to the button and use `<Image fill>`.

The fullscreen modal image keeps `<img>` — it's dynamically sized by the user's viewport with `max-h-[90vh] object-contain`, and converting it would require a fixed-dimension container that breaks the layout.

- [ ] **Step 1: Add import**

At the top of `apps/web/components/image-lightbox.tsx`, add:
```tsx
import Image from 'next/image'
```

- [ ] **Step 2: Replace thumbnail `<img>` with `<Image>`**

Find (~line 88):
```tsx
<button
  key={img.src}
  type="button"
  onClick={() => setOpenIndex(idx)}
  className={itemClassName ?? 'cursor-zoom-in'}
  aria-label={`View ${img.alt} in full size`}
>
  <img
    src={img.thumbnail}
    alt={img.alt}
    className={thumbnailClassName}
    loading={img.priority ? 'eager' : 'lazy'}
    fetchPriority={img.priority ? 'high' : 'auto'}
  />
</button>
```

Replace with:
```tsx
<button
  key={img.src}
  type="button"
  onClick={() => setOpenIndex(idx)}
  className={`relative ${itemClassName ?? 'cursor-zoom-in'}`}
  aria-label={`View ${img.alt} in full size`}
>
  <Image
    src={img.thumbnail}
    alt={img.alt}
    fill
    sizes="(max-width: 512px) 33vw, 170px"
    className={thumbnailClassName}
    priority={img.priority}
  />
</button>
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/image-lightbox.tsx
git commit -m "perf: use next/image for lightbox thumbnails"
```

---

### Task 5: Add `loading.tsx` files for data-heavy routes

**Files:**
- Create: `apps/web/app/(app)/loading.tsx`
- Create: `apps/web/app/(app)/profile/loading.tsx`
- Create: `apps/web/app/place/[id]/loading.tsx`

These are App Router Suspense boundaries. They render instantly on navigation, replaced by the real page once server data is ready. Use only existing CSS classes — no new styles.

- [ ] **Step 1: Create feed loading skeleton**

Create `apps/web/app/(app)/loading.tsx`:

```tsx
export default function FeedLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-snack-surface" />
        <div className="h-4 w-72 animate-pulse rounded-lg bg-snack-surface" />
      </div>
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-56 animate-pulse bg-snack-surface" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create profile loading skeleton**

Create `apps/web/app/(app)/profile/loading.tsx`:

```tsx
export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="card p-6 mb-6 flex items-center gap-4 animate-pulse">
        <div className="h-16 w-16 rounded-full bg-snack-surface flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 rounded-lg bg-snack-surface" />
          <div className="h-4 w-48 rounded-lg bg-snack-surface" />
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card h-24 animate-pulse bg-snack-surface" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create place detail loading skeleton**

Create `apps/web/app/place/[id]/loading.tsx`:

```tsx
export default function PlaceLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 h-9 w-20 animate-pulse rounded-xl bg-snack-surface" />
      <div className="card mb-6 p-5 animate-pulse space-y-4">
        <div className="h-7 w-48 rounded-lg bg-snack-surface" />
        <div className="h-4 w-64 rounded-lg bg-snack-surface" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-snack-surface" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card h-48 animate-pulse bg-snack-surface" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(app)/loading.tsx" \
        "apps/web/app/(app)/profile/loading.tsx" \
        "apps/web/app/place/[id]/loading.tsx"
git commit -m "feat: add loading.tsx skeleton screens for feed, profile, and place routes"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full build**

```bash
cd apps/web && pnpm build 2>&1 | grep -E "error TS|Error" | head -20
```

Expected: clean build, no errors.

- [ ] **Step 2: Visual check — review cards**

Navigate to `/` — review card photos should load with a blurred placeholder before appearing. No layout shift on load.

- [ ] **Step 3: Visual check — loading skeletons**

Slow the network in DevTools (Network tab → Throttling → Slow 3G). Navigate between feed, profile, and a place page — skeleton screens should appear during navigation instead of a blank/stale screen.

- [ ] **Step 4: Visual check — avatar**

Go to a profile page or open a review card — avatar thumbnails should load optimised. TopNav profile avatar should now be 44×44px.
