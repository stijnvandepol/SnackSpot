'use client'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminUser {
  id: string
  email: string
  username: string
  role: string
  isVerified: boolean
  bannedAt: string | null
  createdAt: string
  updatedAt: string
  _count: { reviews: number; reviewLikes: number; favorites: number }
}

const ROLE_OPTIONS = ['USER', 'MODERATOR', 'ADMIN'] as const

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('USER')
  const [isVerified, setIsVerified] = useState(false)

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user)
        setEmail(data.user.email)
        setUsername(data.user.username)
        setRole(data.user.role)
        setIsVerified(data.user.isVerified ?? false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, role, isVerified }),
      })

      if (res.ok) {
        alert('Gebruiker bijgewerkt!')
        router.push('/dashboard/users')
      } else {
        const data = await res.json()
        alert(`Fout: ${data.error}`)
      }
    } catch (error) {
      alert('Er is een fout opgetreden')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Laden...</div>
  }

  if (!user) {
    return <div className="text-center py-12">Gebruiker niet gevonden</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Gebruiker bewerken</h1>

      <div className="card max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Username</label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Rol</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isVerified}
                onChange={(e) => setIsVerified(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex items-center gap-2">
                Geverifieerd
                <svg className="w-5 h-5 text-blue-500" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="11" fill="currentColor" />
                  <path d="M6.5 11.5L9.5 14.5L15.5 8.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Toon een verificatiebadge naast de gebruikersnaam (zoals Instagram)
            </p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-2">
              <strong>ID:</strong> {user.id}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Aangemaakt:</strong>{' '}
              {new Date(user.createdAt).toLocaleString('nl-NL')}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Reviews:</strong> {user._count.reviews}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Likes gegeven:</strong> {user._count.reviewLikes}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Favorieten:</strong> {user._count.favorites}
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <button onClick={handleSave} className="btn btn-primary">
              Opslaan
            </button>
            <button
              onClick={() => router.push('/dashboard/users')}
              className="btn btn-secondary"
            >
              Annuleer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
