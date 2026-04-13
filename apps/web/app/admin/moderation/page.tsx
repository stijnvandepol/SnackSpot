'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { photoVariantUrl } from '@/lib/photo-url'

interface Report {
  id: string; targetType: string; reason: string; status: string; createdAt: string
  reporter: { id: string; username: string }
  review: { id: string; text: string; status: string; user: { id: string; username: string } } | null
  photo: { id: string; variants: Record<string, string>; moderationStatus: string } | null
}

export default function ModerationPage() {
  const { user, accessToken } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canAccess = user?.role === 'MODERATOR' || user?.role === 'ADMIN'

  const load = () => {
    if (!accessToken) return
    setLoading(true)
    fetch('/api/v1/mod/queue?status=OPEN&limit=50', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((json) => setReports(json.data?.data ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (canAccess) load() }, [canAccess, accessToken]) // eslint-disable-line

  const doAction = async (action: string, targetType: string, targetId: string, reportId: string, note?: string) => {
    if (!accessToken) return
    setActionLoading(reportId)
    await fetch('/api/v1/mod/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ action, targetType, targetId, reportId, note }),
    })
    setActionLoading(null)
    load()
  }

  if (!user || !canAccess) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-5xl mb-4">🚫</p>
        <p className="font-semibold text-gray-700">You don&apos;t have access to this page.</p>
        <Link href="/" className="btn-primary mt-4 inline-block">Back to Feed</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🛡️ Moderation Queue</h1>
        <Link href="/admin/marketing" className="btn-secondary text-sm">📣 Marketing email</Link>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-gray-100" />)}
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">✅</p>
          <p className="text-gray-500">All clear – no open reports!</p>
        </div>
      )}

      <div className="space-y-4">
        {reports.map((report) => (
          <div key={report.id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                  report.targetType === 'REVIEW' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {report.targetType}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  by @{report.reporter.username} · {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="text-gray-500 font-medium mb-1">Reason:</p>
              <p className="text-gray-700">{report.reason}</p>
            </div>

            {report.review && (
              <div className="bg-yellow-50 rounded-xl p-3 text-sm">
                <p className="text-gray-500 font-medium mb-1">Review by @{report.review.user.username}:</p>
                <p className="text-gray-700 line-clamp-3">{report.review.text}</p>
                <p className="text-xs text-gray-400 mt-1">Status: {report.review.status}</p>
              </div>
            )}

            {report.photo && (
              <div className="flex items-center gap-3">
                {report.photo.variants?.thumb && (
                  <img
                    src={photoVariantUrl(report.photo.variants as Record<string, string>, ['thumb']) ?? undefined}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                )}
                <p className="text-sm text-gray-500">Moderation: {report.photo.moderationStatus}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {report.review && (
                <>
                  <button
                    className="btn-secondary text-xs py-1.5 px-3"
                    disabled={actionLoading === report.id}
                    onClick={() => doAction('HIDE_REVIEW', 'REVIEW', report.review!.id, report.id)}
                  >
                    Hide Review
                  </button>
                  <button
                    className="btn-secondary text-xs py-1.5 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    disabled={actionLoading === report.id}
                    onClick={() => doAction('DELETE_REVIEW', 'REVIEW', report.review!.id, report.id)}
                  >
                    Delete Review
                  </button>
                  {user.role === 'ADMIN' && (
                    <button
                      className="btn-secondary text-xs py-1.5 px-3 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                      disabled={actionLoading === report.id}
                      onClick={() => doAction('BAN_USER', 'USER', report.review!.user.id, report.id, `Banned via report ${report.id}`)}
                    >
                      Ban User
                    </button>
                  )}
                </>
              )}
              {report.photo && (
                <button
                  className="btn-secondary text-xs py-1.5 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  disabled={actionLoading === report.id}
                  onClick={() => doAction('DELETE_PHOTO', 'PHOTO', report.photo!.id, report.id)}
                >
                  Remove Photo
                </button>
              )}
              <button
                className="btn-secondary text-xs py-1.5 px-3 text-gray-400"
                disabled={actionLoading === report.id}
                onClick={() => doAction('DISMISS_REPORT', 'REPORT', report.id, report.id)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
