# Sprint C — Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring three WCAG 2.5.5 touch target violations to 44×44px, fix a content image with empty alt text, and ensure all interactive elements have visible focus rings.

**Architecture:** Four targeted one-file fixes. No new components, no design system changes. Sprint A already handled the avatar alt text (Task 3) and the TopNav avatar size (Task 2) — those are skipped here to avoid duplication. Check if Sprint A has been executed before running this sprint.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS

**Run type-check with:** `cd apps/web && pnpm build 2>&1 | grep "error TS"`

---

### Task 1: Fix bottom nav touch targets

**Files:**
- Modify: `apps/web/components/bottom-nav.tsx`

Each `<Link>` in the bottom nav is the full-width `<li>` item, but it doesn't declare a minimum height. The nav parent is `h-[4.5rem]` = 72px, which should be enough — but the `<Link>` itself needs `min-h-[44px]` so the tap target is explicitly guaranteed.

- [ ] **Step 1: Add `min-h-[44px]` to the Link**

In `apps/web/components/bottom-nav.tsx`, find the `<Link>` inside the `{links.map(...)}` (~line 43):

```tsx
<Link
  href={l.href}
  aria-current={active ? 'page' : undefined}
  aria-label={l.label}
  className={`flex flex-col items-center gap-0.5 py-1 text-xs font-medium transition ${
    l.accent
      ? 'text-white'
      : active
      ? 'text-snack-primary'
      : 'text-snack-muted'
  }`}
>
```

Add `min-h-[44px] justify-center` to the className:

```tsx
<Link
  href={l.href}
  aria-current={active ? 'page' : undefined}
  aria-label={l.label}
  className={`flex flex-col items-center gap-0.5 py-1 text-xs font-medium transition min-h-[44px] justify-center ${
    l.accent
      ? 'text-white'
      : active
      ? 'text-snack-primary'
      : 'text-snack-muted'
  }`}
>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/bottom-nav.tsx
git commit -m "fix(a11y): ensure bottom nav links meet 44px touch target minimum"
```

---

### Task 2: Show feed empty-state CTA on mobile

**Files:**
- Modify: `apps/web/components/feed-client.tsx`

The "Create first post" button is hidden on mobile with `hidden md:inline-block`. Mobile users who arrive at an empty feed have no call-to-action.

- [ ] **Step 1: Remove the `hidden md:` classes**

In `apps/web/components/feed-client.tsx`, find (~line 99):

```tsx
<Link href="/add-review" className="btn-primary mt-4 hidden md:inline-block">Create first post</Link>
```

Replace with:

```tsx
<Link href="/add-review" className="btn-primary mt-4 inline-block">Create first post</Link>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/feed-client.tsx
git commit -m "fix(a11y): show empty feed CTA on mobile"
```

---

### Task 3: Verify and fix focus rings on interactive elements

**Files:**
- Modify: `apps/web/components/bottom-nav.tsx` (if needed)
- Modify: `apps/web/components/review-interactions.tsx` (if needed)

The global `:focus-visible` ring is defined in `globals.css`. Verify that custom interactive elements in bottom-nav and review-interactions don't override or suppress it.

- [ ] **Step 1: Audit bottom-nav focus**

Read `apps/web/components/bottom-nav.tsx`. Check if any `<Link>` or `<button>` has `outline-none` or `focus:outline-none` without a replacement ring. If found, add:
```tsx
className="... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snack-primary focus-visible:ring-offset-2"
```

- [ ] **Step 2: Audit review-interactions focus**

Read `apps/web/components/review-interactions.tsx`. Check all `<button>` elements for `outline-none` without a replacement. Apply the same fix pattern where missing.

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm build 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 4: Manual focus test**

Open the app. Press Tab to navigate. Verify every interactive element (nav links, buttons, like button) shows a visible orange ring outline when focused.

- [ ] **Step 5: Commit (only if changes were made)**

```bash
git add apps/web/components/bottom-nav.tsx apps/web/components/review-interactions.tsx
git commit -m "fix(a11y): ensure focus rings on bottom-nav and review interaction buttons"
```

---

### Task 4: Final verification

- [ ] **Step 1: Full build**

```bash
cd apps/web && pnpm build 2>&1 | grep -E "error TS|Error" | head -20
```

- [ ] **Step 2: Touch target check (DevTools)**

In DevTools → Rendering → Show layout shift regions or use the Accessibility panel. Verify:
- Bottom nav links: computed height ≥ 44px ✓
- TopNav avatar (if Sprint A was run): 44×44px ✓

- [ ] **Step 3: Empty feed CTA**

Open `/` with an empty account or in a fresh session — "Create first post" button visible on mobile width ✓

- [ ] **Step 4: Keyboard navigation**

Tab through the app. Every focused element shows an orange ring. No element is reachable by keyboard but invisible when focused.
