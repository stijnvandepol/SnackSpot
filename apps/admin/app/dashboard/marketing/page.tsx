'use client'
import { useState } from 'react'

type RecipientMode = 'all' | 'specific'

interface SendResult {
  sent: number
  failed: number
  total: number
}

export default function MarketingPage() {
  const [subject, setSubject]           = useState('')
  const [eyebrow, setEyebrow]           = useState('Update from SnackSpot')
  const [title, setTitle]               = useState('')
  const [intro, setIntro]               = useState('')
  const [calloutTitle, setCalloutTitle] = useState('Stay curious')
  const [calloutBody, setCalloutBody]   = useState('')
  const [actionLabel, setActionLabel]   = useState('')
  const [actionHref, setActionHref]     = useState('')
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('specific')
  const [usernamesInput, setUsernamesInput] = useState('')

  const [sending, setSending] = useState(false)
  const [result, setResult]   = useState<SendResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSend = async () => {
    setResult(null)
    setErrorMsg(null)

    if (!subject.trim() || !title.trim() || !intro.trim() || !calloutBody.trim()) {
      setErrorMsg('Subject, titel, intro en callout zijn verplicht.')
      return
    }

    const recipients: 'all' | { usernames: string[] } =
      recipientMode === 'all'
        ? 'all'
        : {
            usernames: usernamesInput
              .split(/[\n,]+/)
              .map((u) => u.replace('@', '').trim())
              .filter(Boolean),
          }

    if (recipientMode === 'specific' && typeof recipients !== 'string' && recipients.usernames.length === 0) {
      setErrorMsg('Voer minimaal één gebruikersnaam in.')
      return
    }

    const payload: Record<string, unknown> = {
      subject: subject.trim(),
      eyebrow: eyebrow.trim() || 'Update from SnackSpot',
      title: title.trim(),
      intro: intro.trim(),
      calloutTitle: calloutTitle.trim() || 'Stay curious',
      calloutBody: calloutBody.trim(),
      recipients,
    }

    if (actionLabel.trim() && actionHref.trim()) {
      payload.action = { label: actionLabel.trim(), href: actionHref.trim() }
    }

    setSending(true)
    try {
      const res = await fetch('/api/marketing-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error ?? 'Er is iets misgegaan.')
      } else {
        setResult(json)
      }
    } catch {
      setErrorMsg('Netwerk fout — server niet bereikbaar.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📣 Marketing Email</h1>
        <p className="mt-1 text-sm text-gray-500">
          Stuur een e-mail naar alle gebruikers of een specifieke persoon om te testen.
        </p>
      </div>

      <div className="space-y-5">
        {/* Recipients — bovenaan zodat je altijd test-modus kiest */}
        <fieldset className="rounded-xl border border-gray-200 p-4 bg-white">
          <legend className="px-1 text-sm font-semibold text-gray-700">Ontvangers</legend>
          <div className="mt-3 space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="recipients"
                value="specific"
                checked={recipientMode === 'specific'}
                onChange={() => setRecipientMode('specific')}
                className="accent-orange-500"
              />
              <span className="text-sm font-medium text-gray-800">Specifieke gebruikers (test)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="recipients"
                value="all"
                checked={recipientMode === 'all'}
                onChange={() => setRecipientMode('all')}
                className="accent-orange-500"
              />
              <span className="text-sm font-medium text-gray-800">Iedereen (alle niet-geblokkeerde gebruikers)</span>
            </label>

            {recipientMode === 'specific' && (
              <div className="ml-7">
                <label className="mb-1.5 block text-xs font-medium text-gray-500">
                  Gebruikersnamen — één per regel of komma-gescheiden (@ optioneel)
                </label>
                <textarea
                  rows={3}
                  value={usernamesInput}
                  onChange={(e) => setUsernamesInput(e.target.value)}
                  placeholder={'stijn\njohn\n@emma'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}

            {recipientMode === 'all' && (
              <p className="ml-7 text-xs text-red-600 font-medium">
                Verstuurt naar alle gebruikers. Gebruik &quot;Specifieke gebruikers&quot; om eerst te testen.
              </p>
            )}
          </div>
        </fieldset>

        {/* Subject */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Onderwerpregel <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="bijv. We hebben iets nieuws voor je 🎉"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Eyebrow + Title */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Eyebrow label</label>
            <input
              type="text"
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              placeholder="Update from SnackSpot"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="mt-1 text-xs text-gray-400">Klein label boven de titel</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="bijv. Nieuw in SnackSpot"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Intro body */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Berichttekst <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={5}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="Schrijf je bericht hier. Gebruik regeleindes voor alinea&apos;s."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
          />
        </div>

        {/* Callout block */}
        <fieldset className="rounded-xl border border-gray-200 p-4 bg-white">
          <legend className="px-1 text-sm font-semibold text-gray-700">Callout blok</legend>
          <p className="mt-1 mb-3 text-xs text-gray-400">Het gekleurde kader onderaan het bericht.</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Callout titel</label>
              <input
                type="text"
                value={calloutTitle}
                onChange={(e) => setCalloutTitle(e.target.value)}
                placeholder="Stay curious"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">
                Callout tekst <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={calloutBody}
                onChange={(e) => setCalloutBody(e.target.value)}
                placeholder="bijv. Blijf je eten-ontdekkingen delen met de community!"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
              />
            </div>
          </div>
        </fieldset>

        {/* Optional CTA button */}
        <fieldset className="rounded-xl border border-gray-200 p-4 bg-white">
          <legend className="px-1 text-sm font-semibold text-gray-700">Knop (optioneel)</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Knoptekst</label>
              <input
                type="text"
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                placeholder="bijv. Open SnackSpot"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Knop URL</label>
              <input
                type="url"
                value={actionHref}
                onChange={(e) => setActionHref(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </fieldset>

        {/* Feedback */}
        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {result && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            <p className="font-semibold">Verzonden!</p>
            <p className="mt-1">
              {result.sent} van {result.total} succesvol verzonden
              {result.failed > 0 && ` · ${result.failed} mislukt (controleer logs)`}
            </p>
          </div>
        )}

        {/* Send button */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {sending
              ? 'Bezig met verzenden…'
              : recipientMode === 'all'
                ? 'Verzend naar iedereen'
                : 'Verzend naar geselecteerde gebruikers'}
          </button>
        </div>
      </div>
    </div>
  )
}
