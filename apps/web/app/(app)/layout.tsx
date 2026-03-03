import { BottomNav } from '../../components/bottom-nav';
import { TopNav } from '../../components/top-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <TopNav />
      <main className="mx-auto grid max-w-6xl md:grid-cols-[1fr_280px] md:gap-6">
        <section className="px-4 py-4">{children}</section>
        <aside className="hidden border-l px-4 py-4 md:block">
          <h2 className="mb-3 text-sm font-semibold">Filters</h2>
          <div className="space-y-2 text-sm text-zinc-700">
            <p>Sortering</p>
            <p>Radius</p>
            <p>Min score</p>
          </div>
        </aside>
      </main>
      <BottomNav />
    </div>
  );
}
