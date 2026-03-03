export default function PlaceDetailPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="rounded-xl border p-4">
        <h1 className="text-xl font-bold">Place detail</h1>
        <p className="text-sm text-zinc-600">Naam, adres, gemiddelde score, foto-grid en acties.</p>
      </header>
      <div className="rounded-xl border p-4 text-sm">Reviews met sortering new/top en filters met foto.</div>
      <div className="rounded-xl border border-dashed p-4 text-sm text-zinc-500">Empty state: nog geen reviews voor deze plek.</div>
    </main>
  );
}
