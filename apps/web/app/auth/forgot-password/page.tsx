export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-bold">Forgot password</h1>
      <input className="w-full rounded-xl border px-3 py-2" placeholder="Email" />
      <button className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-white">Verstuur reset link</button>
    </main>
  );
}
