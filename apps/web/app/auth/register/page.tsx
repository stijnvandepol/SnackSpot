export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-bold">Register</h1>
      <input className="w-full rounded-xl border px-3 py-2" placeholder="Username" />
      <input className="w-full rounded-xl border px-3 py-2" placeholder="Email" />
      <input className="w-full rounded-xl border px-3 py-2" placeholder="Password" type="password" />
      <button className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-white">Account maken</button>
    </main>
  );
}
