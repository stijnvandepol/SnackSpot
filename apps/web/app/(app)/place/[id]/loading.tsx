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
