export default function FeedLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-snack-surface" />
        <div className="h-4 w-72 animate-pulse rounded-lg bg-snack-surface" />
      </div>
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-56 animate-pulse bg-snack-surface" />
        ))}
      </div>
    </div>
  )
}
