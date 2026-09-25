'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { authHref } from '@/lib/next-path'
import { track } from '@/lib/analytics'

/**
 * "Bewaren" on a place page. For a logged-out visitor this is often the first reason to make
 * an account that asks for less than writing a review, so the logged-out state is a link to
 * registration that comes back here.
 */
export function SavePlaceButton({ placeId }: { placeId: string }) {
  const { user, accessToken, loading } = useAuth()
  const [saved, setSaved] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    fetch(`/api/v1/places/${encodeURIComponent(placeId)}/favorite`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => { if (!cancelled) setSaved(Boolean(json.data?.saved)) })
      .catch(() => { if (!cancelled) setSaved(false) }) // unknown state: offer to save
    return () => { cancelled = true }
  }, [accessToken, placeId])

  if (loading) return null

  if (!user) {
    return (
      <Link
        href={authHref('register', `/place/${placeId}`)}
        onClick={() => track('cta_register_click', { source: 'save_place' })}
        className="btn-secondary text-sm"
      >
        <span aria-hidden="true">☆</span> Bewaren
      </Link>
    )
  }

  const toggle = async () => {
    if (!accessToken || saved === null) return
    const next = !saved
    setBusy(true)
    setError(null)
    setSaved(next) // optimistic; reverted below on failure
    try {
      const res = await fetch(`/api/v1/places/${encodeURIComponent(placeId)}/favorite`, {
        method: next ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      setSaved(!next)
      setError(next ? 'Bewaren lukte niet. Probeer het opnieuw.' : 'Verwijderen lukte niet. Probeer het opnieuw.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || saved === null}
        aria-pressed={saved === true}
        className="btn-secondary text-sm"
      >
        <span aria-hidden="true">{saved ? '★' : '☆'}</span> {saved ? 'Bewaard' : 'Bewaren'}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
