export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Profile & Settings</h1>
      <div className="rounded-xl border p-4">
        <p className="font-semibold">@username</p>
        <p className="text-sm text-zinc-600">Reviews: 12 · Favorites: 8</p>
      </div>
      <div className="rounded-xl border p-4 text-sm">
        <p className="font-medium">Privacy</p>
        <p className="text-zinc-600">Data export (JSON) en account verwijderen/anonimiseren.</p>
      </div>
    </div>
  );
}
