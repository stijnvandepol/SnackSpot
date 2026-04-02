export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="card p-6 mb-6 flex items-center gap-4 animate-pulse">
        <div className="h-16 w-16 rounded-full bg-snack-surface flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 rounded-lg bg-snack-surface" />
          <div className="h-4 w-48 rounded-lg bg-snack-surface" />
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card h-24 animate-pulse bg-snack-surface" />
        ))}
      </div>
    </div>
  )
}
