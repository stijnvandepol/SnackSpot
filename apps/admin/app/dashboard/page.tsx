'use client'
import { useEffect, useState } from 'react'

interface Stats {
  totalUsers: number
  totalPlaces: number
  totalReviews: number
  recentUsers: number
  recentReviews: number
  placesWithoutReviews: number
  openReports: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) return

    fetch('/api/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-center py-12">Laden...</div>
  }

  const statCards = [
    { label: 'Totaal Gebruikers', value: stats?.totalUsers ?? 0, icon: '👥', color: 'blue' },
    { label: 'Totaal Restaurants', value: stats?.totalPlaces ?? 0, icon: '🏪', color: 'green' },
    { label: 'Totaal Reviews', value: stats?.totalReviews ?? 0, icon: '⭐', color: 'yellow' },
    { label: 'Open Meldingen', value: stats?.openReports ?? 0, icon: '🚨', color: 'red', link: '/dashboard/reports' },
    { label: 'Nieuwe gebruikers (7d)', value: stats?.recentUsers ?? 0, icon: '📈', color: 'purple' },
    { label: 'Nieuwe reviews (7d)', value: stats?.recentReviews ?? 0, icon: '✍️', color: 'pink' },
    { label: 'Restaurants zonder reviews', value: stats?.placesWithoutReviews ?? 0, icon: '⚠️', color: 'orange' },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <div key={stat.label} className="card">
            {stat.link ? (
              <a href={stat.link} className="block">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold">{stat.value.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">{stat.icon}</div>
                </div>
                {stat.value > 0 && (
                  <p className="text-xs text-blue-600 mt-2">→ Bekijken</p>
                )}
              </a>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value.toLocaleString()}</p>
                </div>
                <div className="text-4xl">{stat.icon}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 card">
        <h2 className="text-xl font-semibold mb-4">Welkom bij het SnackSpot Admin Panel</h2>
        <p className="text-gray-600 mb-4">
          Gebruik het menu aan de linkerkant om gebruikers, restaurants en reviews te beheren.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Tip:</strong> Dit admin panel draait op een aparte poort (3001) voor extra beveiliging.
            Zorg ervoor dat deze poort alleen toegankelijk is voor admins via je firewall/reverse proxy.
          </p>
        </div>
      </div>
    </div>
  )
}
