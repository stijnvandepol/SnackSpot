'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { authHref } from '@/lib/next-path'

const REASONS = [
  { value: 'closed', label: 'Deze zaak is gesloten' },
  { value: 'address', label: 'Adres of locatie klopt niet' },
  { value: 'duplicate', label: 'Deze zaak staat er dubbel in' },
  { value: 'name', label: 'De naam klopt niet' },
  { value: 'other', label: 'Iets anders' },
] as const

type Reason = (typeof REASONS)[number]['value']

/**
 * "Klopt er iets niet?" — lets visitors flag stale place data. With a small team, the
 * people standing in front of the snackbar are the only ones who know it closed last month.
 * Reports land in the existing moderation queue as target type PLACE.
 */
export function ReportPlace({ placeId, placeName }: { placeId: string; placeName: string }) {
  const { user, accessToken } = useAuth()
  const [reason, setReason] = useState<Reason | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken || !reason) return
    const label = REASONS.find((r) => r.value === reason)?.label ?? reason
    const text = `${label}${note.trim() ? `: ${note.trim()}` : ''}`.slice(0, 500)
    setState('sending')
    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ targetType: 'PLACE', placeId, reason: text.length >= 5 ? text : `${text} (${placeName})` }),
      })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <p role="status" className="text-xs text-green-700 dark:text-green-400">
        Bedankt! We kijken ernaar en passen het zo nodig aan.
      </p>
    )
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs font-medium text-snack-muted hover:text-snack-text">
        Klopt er iets niet aan deze zaak?
      </summary>
      {!user ? (
        <p className="mt-2 text-xs text-snack-muted">
          <Link href={authHref('login', `/place/${placeId}`)} className="text-snack-primary hover:underline">
            Log in
          </Link>{' '}
          om een correctie door te geven.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <fieldset>
            <legend className="sr-only">Wat klopt er niet?</legend>
            {REASONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 py-1 text-sm text-snack-text">
                <input
                  type="radio"
                  name="place-report-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  className="accent-snack-primary"
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <label className="block">
            <span className="label">Toelichting (optioneel)</span>
            <textarea
              className="input min-h-[64px]"
              maxLength={400}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bijvoorbeeld het juiste adres, of welke zaak het origineel is."
            />
          </label>
          <button type="submit" className="btn-secondary text-sm py-2" disabled={!reason || state === 'sending'}>
            {state === 'sending' ? 'Versturen…' : 'Doorgeven'}
          </button>
          {state === 'error' && (
            <p role="alert" className="text-xs text-red-600">Versturen lukte niet. Probeer het opnieuw.</p>
          )}
        </form>
      )}
    </details>
  )
}
