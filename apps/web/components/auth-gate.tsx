import Link from 'next/link'
import { authHref } from '@/lib/next-path'

/**
 * What a logged-out visitor sees on a signed-in page.
 *
 * These used to be a single "Log in" button that dropped people on `/` afterwards. The gate
 * now offers registration first (most visitors here do not have an account yet) and brings
 * them back to `returnTo` once they do.
 */
export function AuthGate({ title, body, returnTo }: { title: string; body: string; returnTo: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-heading text-xl font-bold text-snack-text">{title}</h1>
      <p className="mt-2 text-sm text-snack-muted">{body}</p>
      <div className="mt-5 flex flex-col gap-2">
        <Link href={authHref('register', returnTo)} className="btn-primary">
          Gratis account maken
        </Link>
        <Link href={authHref('login', returnTo)} className="btn-secondary">
          Ik heb al een account
        </Link>
      </div>
    </div>
  )
}
