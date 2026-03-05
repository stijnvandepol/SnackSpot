'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/')
      return
    }

    // Verify token and get user info
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized')
        return res.json()
      })
      .then((data) => {
        setUser(data.user)
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem('admin_token')
        router.push('/')
      })
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    )
  }

  const navItems = [
    { href: '/dashboard', label: '📊 Dashboard', icon: '📊' },
    { href: '/dashboard/users', label: '👥 Gebruikers', icon: '👥' },
    { href: '/dashboard/places', label: '🏪 Restaurants', icon: '🏪' },
    { href: '/dashboard/reviews', label: '⭐ Reviews', icon: '⭐' },
    { href: '/dashboard/reports', label: '🚨 Meldingen', icon: '🚨' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-950 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold">🍕 SnackSpot</h1>
          <p className="text-sm text-slate-400 mt-1">Admin Panel</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-4 py-3 rounded-lg transition-colors ${
                    pathname === item.href
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="mb-3">
            <p className="text-sm text-slate-400">Ingelogd als:</p>
            <p className="font-medium">{user?.username}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
          >
            Uitloggen
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
