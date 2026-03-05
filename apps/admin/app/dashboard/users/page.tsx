'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface User {
  id: string
  email: string
  username: string
  role: string
  bannedAt: string | null
  createdAt: string
  _count: { reviews: number }
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const loadUsers = async () => {
    const token = localStorage.getItem('admin_token')
    if (!token) return

    setLoading(true)
    try {
      const res = await fetch(`/api/users?page=${page}&search=${search}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setUsers(data.users || [])
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [page, search])

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return

    const token = localStorage.getItem('admin_token')
    if (!token) return

    try {
      const res = await fetch(`/api/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      })

      if (res.ok) {
        alert('Wachtwoord succesvol gereset!')
        setShowModal(false)
        setNewPassword('')
        setSelectedUser(null)
      } else {
        const data = await res.json()
        alert(`Fout: ${data.error}`)
      }
    } catch (error) {
      alert('Er is een fout opgetreden')
    }
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Weet je zeker dat je gebruiker "${username}" wilt verwijderen?`)) return

    const token = localStorage.getItem('admin_token')
    if (!token) return

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        alert('Gebruiker verwijderd')
        loadUsers()
      } else {
        const data = await res.json()
        alert(`Fout: ${data.error}`)
      }
    } catch (error) {
      alert('Er is een fout opgetreden')
    }
  }

  const handleToggleBan = async (user: User) => {
    const token = localStorage.getItem('admin_token')
    if (!token) return

    const newBannedAt = user.bannedAt ? null : new Date().toISOString()

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bannedAt: newBannedAt }),
      })

      if (res.ok) {
        loadUsers()
      } else {
        const data = await res.json()
        alert(`Fout: ${data.error}`)
      }
    } catch (error) {
      alert('Er is een fout opgetreden')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">👥 Gebruikers</h1>
      </div>

      <div className="card mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Zoek op email of username..."
            className="input flex-1"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Laden...</div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Reviews</th>
                  <th>Status</th>
                  <th>Aangemaakt</th>
                  <th>Acties</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.username}</td>
                    <td>{user.email}</td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          user.role === 'ADMIN'
                            ? 'bg-red-100 text-red-800'
                            : user.role === 'MODERATOR'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td>{user._count.reviews}</td>
                    <td>
                      {user.bannedAt ? (
                        <span className="text-red-600 font-medium">Gebanned</span>
                      ) : (
                        <span className="text-green-600">Actief</span>
                      )}
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString('nl-NL')}</td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          href={`/dashboard/users/${user.id}`}
                          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                        >
                          Bewerk
                        </Link>
                        <button
                          onClick={() => {
                            setSelectedUser(user)
                            setShowModal(true)
                          }}
                          className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                        >
                          Reset PW
                        </button>
                        <button
                          onClick={() => handleToggleBan(user)}
                          className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                        >
                          {user.bannedAt ? 'Unban' : 'Ban'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Verwijder
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Totaal: {total} gebruikers
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary"
              >
                Vorige
              </button>
              <span className="px-4 py-2">Pagina {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={users.length < 50}
                className="btn btn-secondary"
              >
                Volgende
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reset Password Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">
              Wachtwoord resetten voor {selectedUser.username}
            </h2>
            <div className="mb-4">
              <label className="label">Nieuw wachtwoord</label>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 karakters"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleResetPassword} className="btn btn-primary">
                Reset wachtwoord
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setNewPassword('')
                  setSelectedUser(null)
                }}
                className="btn btn-secondary"
              >
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
