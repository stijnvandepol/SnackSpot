// Guides render inside the app chrome (TopNav/BottomNav from the (app) layout)
// but keep the light "document" look they were designed with — the prose styling
// is light-oriented, so we lock the subtree to light theme regardless of the
// app's dark-mode toggle. This mirrors how they rendered in the marketing shell.
//
// lang="en" because the guides are still written in English while the rest of the
// indexable site is Dutch (<html lang="nl"> in app/layout.tsx). Marking the subtree
// keeps the document honest for screen readers and for Google's language detection.
// Remove this once the guides are translated.
export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en" className="force-light min-h-full" style={{ backgroundColor: 'var(--snack-bg)' }}>
      {children}
    </div>
  )
}
