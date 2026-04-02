'use client'
import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'

type RecipientMode = 'all' | 'specific'

interface Result {
  sent: number
  failed: number
  total: number
}

export default function MarketingPage() {
  const { user, accessToken } = useAuth()

  const [subject, setSubject]           = useState('')
  const [eyebrow, setEyebrow]           = useState('Update from SnackSpot')
  const [title, setTitle]               = useState('')
  const [intro, setIntro]               = useState('')
  const [calloutTitle, setCalloutTitle] = useState('Stay curious')
  const [calloutBody, setCalloutBody]   = useState('')
  const [actionLabel, setActionLabel]   = useState('')
  const [actionHref, setActionHref]     = useState('')
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all')
  const [usernamesInput, setUsernamesInput] = useState('')

  const [sending, setSending] = useState(false)
  const [result, setResult]   = useState<Result | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-5xl mb-4">🚫</p>
        <p className="font-semibold text-gray-700">You don&apos;t have access to this page.</p>
        <Link href="/" className="btn-primary mt-4 inline-block">Back to Feed</Link>
      </div>
    )
  }

  const handleSend = async () => {
    setResult(null)
    setErrorMsg(null)

    if (!subject.trim() || !title.trim() || !intro.trim() || !calloutBody.trim()) {
      setErrorMsg('Subject, title, intro, and callout body are required.')
      return
    }

    const recipients =
      recipientMode === 'all'
        ? 'all'
        : {
            usernames: usernamesInput
              .split(/[\n,]+/)
              .map((u) => u.replace('@', '').trim())
              .filter(Boolean),
          }

    if (recipientMode === 'specific' && typeof recipients !== 'string' && recipients.usernames.length === 0) {
      setErrorMsg('Enter at least one username.')
      return
    }

    const body: Record<string, unknown> = {
      subject: subject.trim(),
      eyebrow: eyebrow.trim() || 'Update from SnackSpot',
      title: title.trim(),
      intro: intro.trim(),
      calloutTitle: calloutTitle.trim() || 'Stay curious',
      calloutBody: calloutBody.trim(),
      recipients,
    }

    if (actionLabel.trim() && actionHref.trim()) {
      body.action = { label: actionLabel.trim(), href: actionHref.trim() }
    }

    setSending(true)
    try {
      const res = await fetch('/api/v1/admin/marketing-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error ?? 'Something went wrong.')
      } else {
        setResult(json.data)
      }
    } catch {
      setErrorMsg('Network error — could not reach the server.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📣 Marketing Email</h1>
        <Link href="/admin/moderation" className="text-sm text-snack-muted hover:text-snack-text">← Moderation</Link>
      </div>
      <p className="mb-8 text-sm text-snack-muted">
        Compose and send a branded email to all users or a specific group. Uses the same template as other SnackSpot emails.
      </p>

      <div className="space-y-5">
        {/* Subject */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-snack-text" htmlFor="subject">
            Subject line <span className="text-red-500">*</span>
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. We've got something new for you 🎉"
            className="input w-full"
          />
        </div>

        {/* Eyebrow + Title */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-snack-text" htmlFor="eyebrow">
              Eyebrow label
            </label>
            <input
              id="eyebrow"
              type="text"
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              placeholder="Update from SnackSpot"
              className="input w-full"
            />
            <p className="mt-1 text-xs text-snack-muted">Small label above the title</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-snack-text" htmlFor="title">
              Email title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. We've just released something new"
              className="input w-full"
            />
          </div>
        </div>

        {/* Intro body */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-snack-text" htmlFor="intro">
            Message body <span className="text-red-500">*</span>
          </label>
          <textarea
            id="intro"
            rows={5}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="Write your message here. Use new lines to separate paragraphs."
            className="input w-full resize-y"
          />
        </div>

        {/* Optional CTA */}
        <fieldset className="rounded-2xl border border-snack-border p-4">
          <legend className="px-1 text-sm font-semibold text-snack-text">Button (optional)</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-snack-muted" htmlFor="actionLabel">Button label</label>
              <input
                id="actionLabel"
                type="text"
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                placeholder="e.g. Open SnackSpot"
                className="input w-full"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-snack-muted" htmlFor="actionHref">Button URL</label>
              <input
                id="actionHref"
                type="url"
                value={actionHref}
                onChange={(e) => setActionHref(e.target.value)}
                placeholder="https://..."
                className="input w-full"
              />
            </div>
          </div>
        </fieldset>

        {/* Callout block */}
        <fieldset className="rounded-2xl border border-snack-border p-4">
          <legend className="px-1 text-sm font-semibold text-snack-text">Callout block</legend>
          <p className="mb-3 text-xs text-snack-muted">The highlighted box below the message. Good for a tip, encouragement, or CTA context.</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-snack-muted" htmlFor="calloutTitle">Callout title</label>
              <input
                id="calloutTitle"
                type="text"
                value={calloutTitle}
                onChange={(e) => setCalloutTitle(e.target.value)}
                placeholder="Stay curious"
                className="input w-full"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-snack-muted" htmlFor="calloutBody">
                Callout text <span className="text-red-500">*</span>
              </label>
              <textarea
                id="calloutBody"
                rows={3}
                value={calloutBody}
                onChange={(e) => setCalloutBody(e.target.value)}
                placeholder="e.g. Keep sharing your food discoveries with the community!"
                className="input w-full resize-y"
              />
            </div>
          </div>
        </fieldset>

        {/* Recipients */}
        <fieldset className="rounded-2xl border border-snack-border p-4">
          <legend className="px-1 text-sm font-semibold text-snack-text">Recipients</legend>
          <div className="mt-3 space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="recipients"
                value="all"
                checked={recipientMode === 'all'}
                onChange={() => setRecipientMode('all')}
                className="accent-snack-primary"
              />
              <span className="text-sm font-medium text-snack-text">Everyone (all non-banned users)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="recipients"
                value="specific"
                checked={recipientMode === 'specific'}
                onChange={() => setRecipientMode('specific')}
                className="accent-snack-primary"
              />
              <span className="text-sm font-medium text-snack-text">Specific users</span>
            </label>

            {recipientMode === 'specific' && (
              <div className="ml-7">
                <label className="mb-1.5 block text-xs font-medium text-snack-muted" htmlFor="usernames">
                  Usernames — one per line or comma-separated (@ is optional)
                </label>
                <textarea
                  id="usernames"
                  rows={4}
                  value={usernamesInput}
                  onChange={(e) => setUsernamesInput(e.target.value)}
                  placeholder={'stijn\njohn\n@emma'}
                  className="input w-full resize-y font-mono text-sm"
                />
              </div>
            )}
          </div>
        </fieldset>

        {/* Error / result */}
        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {result && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            <p className="font-semibold">Emails sent!</p>
            <p className="mt-1">
              {result.sent} of {result.total} sent successfully
              {result.failed > 0 && ` · ${result.failed} failed (check server logs)`}
            </p>
          </div>
        )}

        {/* Send button */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSend}
            disabled={sending}
            className="btn-primary disabled:opacity-50"
          >
            {sending ? 'Sending…' : recipientMode === 'all' ? 'Send to everyone' : 'Send to selected users'}
          </button>
          {recipientMode === 'all' && (
            <p className="text-xs text-snack-muted">This will email all non-banned users.</p>
          )}
        </div>
      </div>
    </div>
  )
}
