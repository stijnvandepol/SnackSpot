import { TopNav } from '@/components/top-nav'
import { BottomNav } from '@/components/bottom-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      {/* Desktop top nav */}
      <TopNav />

      <main className="flex-1 pb-nav md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
