export default function NearbyPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Nearby</h1>
      <div className="rounded-xl border p-4">
        <p className="text-sm font-medium">Boven de fold</p>
        <p className="text-sm text-zinc-600">Kaart + lijst met places binnen gekozen radius.</p>
      </div>
      <div className="rounded-xl border p-4">
        <label className="block text-sm font-medium">Radius (0.5–25 km)</label>
        <input type="range" min={500} max={25000} defaultValue={3000} className="mt-2 w-full" />
      </div>
      <div className="rounded-xl border border-dashed p-4 text-sm text-zinc-500">Permissie state: locatie toegang geweigerd.</div>
      <div className="rounded-xl border border-dashed p-4 text-sm text-zinc-500">No results: geen places in deze straal.</div>
    </div>
  );
}
