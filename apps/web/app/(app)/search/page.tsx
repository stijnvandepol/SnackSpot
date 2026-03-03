export default function SearchPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Search</h1>
      <input
        placeholder="Zoek places, dishes, users"
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />
      <div className="flex gap-2 text-sm">
        <button className="rounded-full border px-3 py-1">Places</button>
        <button className="rounded-full border px-3 py-1">Dishes</button>
        <button className="rounded-full border px-3 py-1">Users</button>
      </div>
      <div className="rounded-xl border border-dashed p-4 text-sm text-zinc-500">Leeg resultaat: probeer andere zoekterm of grotere radius.</div>
    </div>
  );
}
