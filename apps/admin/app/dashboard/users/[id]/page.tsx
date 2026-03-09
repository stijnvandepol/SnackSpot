'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EditUserPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('USER')

  useEffect(() => {
    fetch(`/api/users/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user)
        setEmail(data.user.email)
        setUsername(data.user.username)
        setRole(data.user.role)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/users/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, role }),
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
              <option value="USER">USER</option>
              <option value="MODERATOR">MODERATOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
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
