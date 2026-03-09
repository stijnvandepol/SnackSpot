'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface FlaggedComment {
  id: string
  matchedWord: string
  status: string
  createdAt: string
  comment: {
    id: string
    text: string
    createdAt: string
    user: { id: string; username: string; email: string }
    review: {
      id: string
      place: { id: string; name: string }
    }
  }
}

interface BlockedWord {
  id: string
  word: string
  createdAt: string
}

export default function CommentsPage() {
  const [tab, setTab] = useState<'flagged' | 'words'>('flagged')

  // --- Flagged comments state ---
  const [flagged, setFlagged] = useState<FlaggedComment[]>([])
  const [flaggedLoading, setFlaggedLoading] = useState(true)
  const [flaggedTotal, setFlaggedTotal] = useState(0)
  const [flaggedPage, setFlaggedPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('PENDING')

  // --- Blocked words state ---
  const [words, setWords] = useState<BlockedWord[]>([])
  const [wordsLoading, setWordsLoading] = useState(true)
  const [newWord, setNewWord] = useState('')
  const [wordError, setWordError] = useState('')

  const loadFlagged = async () => {
    setFlaggedLoading(true)
    try {
      const res = await fetch(`/api/comments/flagged?page=${flaggedPage}&status=${statusFilter}`)
      const data = await res.json()
      setFlagged(data.flagged || [])
      setFlaggedTotal(data.pagination?.total || 0)
    } catch {
      // ignore
    } finally {
      setFlaggedLoading(false)
    }
  }

  const loadWords = async () => {
    setWordsLoading(true)
    try {
      const res = await fetch('/api/comments/blocked-words')
      const data = await res.json()
      setWords(data.words || [])
    } catch {
      // ignore
    } finally {
      setWordsLoading(false)
    }
  }

  useEffect(() => { loadFlagged() }, [flaggedPage, statusFilter])
  useEffect(() => { loadWords() }, [])

  const handleFlagAction = async (flagId: string, action: 'APPROVE' | 'DELETE') => {
    const label = action === 'DELETE' ? 'verwijderen' : 'goedkeuren'
    if (!confirm(`Weet je zeker dat je deze comment wilt ${label}?`)) return
    try {
      const res = await fetch(`/api/comments/flagged/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        loadFlagged()
      } else {
        const data = await res.json()
        alert(`Fout: ${data.error}`)
      }
    } catch {
      alert('Er is een fout opgetreden')
    }
  }

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault()
    setWordError('')
    if (!newWord.trim()) return
    try {
      const res = await fetch('/api/comments/blocked-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewWord('')
        loadWords()
      } else {
        setWordError(data.error || 'Fout bij toevoegen')
      }
    } catch {
      setWordError('Er is een fout opgetreden')
    }
  }

  const handleDeleteWord = async (id: string, word: string) => {
    if (!confirm(`Triggerwoord "${word}" verwijderen?`)) return
    try {
      const res = await fetch(`/api/comments/blocked-words/${id}`, { method: 'DELETE' })
      if (res.ok) loadWords()
      else alert('Fout bij verwijderen')
    } catch {
      alert('Er is een fout opgetreden')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">💬 Comment moderatie</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('flagged')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'flagged'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Gemarkeerde comments
          {flaggedTotal > 0 && statusFilter === 'PENDING' && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
              {flaggedTotal}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('words')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'words'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Triggerwoorden
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
            {words.length}
          </span>
        </button>
      </div>

      {/* Flagged comments tab */}
      {tab === 'flagged' && (
        <div>
          <div className="card mb-6">
            <select
              className="input w-48"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setFlaggedPage(1) }}
            >
              <option value="PENDING">In afwachting</option>
              <option value="APPROVED">Goedgekeurd</option>
              <option value="DELETED">Verwijderd</option>
            </select>
          </div>

          {flaggedLoading ? (
            <div className="text-center py-12">Laden...</div>
          ) : flagged.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-5xl mb-4">✅</p>
              <p className="text-gray-600">Geen gemarkeerde comments gevonden</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flagged.map((item) => (
                <div key={item.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                        triggerwoord: <strong>{item.matchedWord}</strong>
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : item.status === 'APPROVED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status === 'PENDING' ? 'In afwachting' : item.status === 'APPROVED' ? 'Goedgekeurd' : 'Verwijderd'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleString('nl-NL')}
                    </span>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                    <p className="text-gray-800">{item.comment.text}</p>
                  </div>

                  <div className="text-sm text-gray-600 mb-3 flex flex-wrap gap-4">
                    <span>
                      <strong>Gebruiker:</strong>{' '}
                      <Link href={`/dashboard/users/${item.comment.user.id}`} className="text-orange-600 hover:text-orange-700">
                        @{item.comment.user.username}
                      </Link>
                    </span>
                    <span>
                      <strong>Bij review van:</strong>{' '}
                      <Link href={`/dashboard/places/${item.comment.review.place.id}`} className="text-green-600 hover:text-green-700">
                        {item.comment.review.place.name}
                      </Link>
                    </span>
                    <span className="text-gray-400">
                      Geplaatst: {new Date(item.comment.createdAt).toLocaleString('nl-NL')}
                    </span>
                  </div>

                  {item.status === 'PENDING' && (
                    <div className="flex gap-3 pt-3 border-t">
                      <button
                        onClick={() => handleFlagAction(item.id, 'APPROVE')}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        ✓ Goedkeuren
                      </button>
                      <button
                        onClick={() => handleFlagAction(item.id, 'DELETE')}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        ✕ Verwijderen
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-between items-center">
            <p className="text-sm text-gray-600">Totaal: {flaggedTotal}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setFlaggedPage((p) => Math.max(1, p - 1))}
                disabled={flaggedPage === 1}
                className="btn btn-secondary"
              >
                Vorige
              </button>
              <span className="px-4 py-2">Pagina {flaggedPage}</span>
              <button
                onClick={() => setFlaggedPage((p) => p + 1)}
                disabled={flagged.length < 50}
                className="btn btn-secondary"
              >
                Volgende
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked words tab */}
      {tab === 'words' && (
        <div>
          <div className="card mb-6">
            <h2 className="text-lg font-semibold mb-4">Triggerwoord toevoegen</h2>
            <form onSubmit={handleAddWord} className="flex gap-3">
              <input
                type="text"
                className="input flex-1"
                placeholder="Voer een woord in..."
                value={newWord}
                onChange={(e) => { setNewWord(e.target.value); setWordError('') }}
                maxLength={100}
              />
              <button type="submit" className="btn btn-primary">
                Toevoegen
              </button>
            </form>
            {wordError && (
              <p className="mt-2 text-sm text-red-600">{wordError}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Comments die dit woord bevatten worden automatisch gemarkeerd voor beoordeling. Woorden worden opgeslagen in kleine letters.
            </p>
          </div>

          {wordsLoading ? (
            <div className="text-center py-12">Laden...</div>
          ) : words.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-5xl mb-4">🔤</p>
              <p className="text-gray-600">Nog geen triggerwoorden ingesteld</p>
            </div>
          ) : (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Actieve triggerwoorden ({words.length})</h2>
              <div className="flex flex-wrap gap-2">
                {words.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                    title={`Toegevoegd op ${new Date(w.createdAt).toLocaleString('nl-NL')}`}
                  >
                    <span className="font-medium">{w.word}</span>
                    <button
                      onClick={() => handleDeleteWord(w.id, w.word)}
                      className="text-gray-400 hover:text-red-500 transition-colors leading-none"
                      aria-label={`Verwijder ${w.word}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
