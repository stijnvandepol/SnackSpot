---
title: Frontend Refactor — SnackSpot Web
date: 2026-04-02
status: approved
---

# Frontend Refactor Design

## Scope

Targeted refactor of `apps/web`. No functional changes. Goal: fix real bugs (dark mode),
improve code health (DRY, naming), and make the codebase easier for a next developer to read.

Large page files (`add-review/page.tsx`, `profile/page.tsx`) are intentionally left intact —
their size reflects genuine complexity (upload wizard, tabbed profile state) where splitting
would add prop-drilling overhead without meaningful benefit.

---

## Section 1 — Dark Mode Bugfixes

Four places use hardcoded colours that don't adapt to the theme:

| File | Line | Problem | Fix |
|---|---|---|---|
| `components/review-card.tsx` | ~46 | `text-[#e0e0e0]` for empty stars | `text-snack-border` |
| `components/review-card.tsx` | ~119 | `bg-white/90` for tag badges | `bg-snack-surface/90` |
| `app/auth/login/page.tsx` | ~29 | `to-white` in background gradient | `to-snack-bg` |
| `components/feed-client.tsx` | ~104 | `bg-red-50/50 border-red-200 text-red-700` (error card) | Add `dark:` variants |

All other colour usage in these files correctly uses `--snack-*` tokens via Tailwind aliases.

---

## Section 2 — Light Mode as Default

**Current behaviour:** no stored preference → resolves to `'system'` → dark mode activates if the OS is dark.

**Required behaviour:** no stored preference → always light.

Two files need updating:

### `components/theme-provider.tsx`
`getStoredTheme()` currently returns `'system'` as fallback. Change to return `'light'`.

### `app/layout.tsx` — inline FOUC-prevention script
Current logic: applies dark class if `t !== 'light' && matchMedia(...).matches`.
This activates dark when there is no stored preference and the OS prefers dark.

New logic: only apply dark class when `t === 'dark'` (explicit opt-in).

```js
// Before
var d = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme:dark)').matches)

// After
var d = t === 'dark'
```

Users who previously had `'system'` stored will now see light mode on next visit.
This is acceptable and intentional — the default shifts to light.

---

## Section 3 — Logo Deduplication

The SnackSpot logo SVG is duplicated verbatim in three files:
- `components/top-nav.tsx`
- `app/(app)/layout.tsx`
- `app/auth/login/page.tsx`

**Fix:** extract to `components/snack-spot-logo.tsx`.

```tsx
// Signature
export function SnackSpotLogo({ className }: { className?: string })
```

The three call sites replace the inline markup with `<SnackSpotLogo className="..." />`.

---

## Section 4 — File Naming Convention

`components/RelatedGuides.tsx` uses PascalCase — the only file in `components/` that does.
All others use kebab-case.

**Fix:** rename to `components/related-guides.tsx` and update the single import in
`app/guides/page.tsx`.

---

## Section 5 — Readability Comments

Add short comments above non-obvious logic. Rule: only comment where the *why* is unclear
from the code itself. No comments on straightforward CRUD or render logic.

| File | Location | Comment to add |
|---|---|---|
| `app/layout.tsx` | Inline script in `<head>` | Explain it's a FOUC-prevention script that must run sync before React hydrates |
| `components/auth-provider.tsx` | 401 retry block (~line 64) | Explain the token-rotation race condition this guards against |
| `components/feed-client.tsx` | `inFlightRef` + `requestedCursorsRef` | Explain why two refs are needed to prevent duplicate in-flight requests |

---

## What Is NOT Changing

- Component architecture of `add-review/page.tsx` and `profile/page.tsx`
- API routes
- Design tokens (CSS custom properties in `globals.css`)
- Tailwind config
- Auth flow
- Any functionality

---

## Verification Checklist

After implementation, verify:
- [ ] Light mode is the default on first visit (no stored preference)
- [ ] Dark mode still works when explicitly selected in settings
- [ ] System mode still works when selected
- [ ] Empty stars in review cards are visible in dark mode
- [ ] Tag badges on review cards are visible in dark mode
- [ ] Login page background gradient looks correct in both modes
- [ ] Feed error card is readable in dark mode
- [ ] Logo renders correctly in all three locations
- [ ] `/guides` page still loads (RelatedGuides rename)
- [ ] No TypeScript errors
