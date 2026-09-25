// Guides render inside the app chrome (TopNav/BottomNav from the (app) layout)
// but keep the light "document" look they were designed with — the prose styling
// is light-oriented, so we lock the subtree to light theme regardless of the
// app's dark-mode toggle. This mirrors how they rendered in the marketing shell.
//
// The guides are written in Dutch, so they inherit <html lang="nl"> from app/layout.tsx.
export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="force-light min-h-full" style={{ backgroundColor: 'var(--snack-bg)' }}>
      {children}
    </div>
  )
}
