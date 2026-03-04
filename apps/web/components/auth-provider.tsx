'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export interface AuthUser {
  id: string
  email: string
  username: string
  displayName: string | null
  avatarKey: string | null
  role: string
}

interface AuthCtx {
  user: AuthUser | null
  accessToken: string | null
  loading: boolean
  login(email: string, password: string): Promise<{ ok: boolean; error?: string }>
  register(data: {
    email: string
    username: string
    password: string
    displayName?: string
  }): Promise<{ ok: boolean; error?: string }>
  logout(): Promise<void>
  refreshToken(): Promise<boolean>
}

const Ctx = createContext<AuthCtx | null>(null)

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const tokenRef = useRef<string | null>(null)

  const apiFetch = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers)
      if (tokenRef.current) headers.set('Authorization', `Bearer ${tokenRef.current}`)
      return fetch(`/api/v1${path}`, { ...init, credentials: 'include', headers })
    },
    [],
  )

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    if (!res.ok) {
      setUser(null)
      setAccessToken(null)
      tokenRef.current = null
      return false
    }
    const { data } = await res.json()
    tokenRef.current = data.access_token
    setAccessToken(data.access_token)
    return true
  }, [])

  // On mount: try to refresh (restores session from httpOnly cookie)
  useEffect(() => {
    refreshToken()
      .then(async (ok) => {
        if (ok) {
          const res = await fetch('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${tokenRef.current}` },
          })
          if (res.ok) {
            const { data } = await res.json()
            setUser(data)
          }
        }
      })
      .finally(() => setLoading(false))
  }, [refreshToken])

  // Proactively refresh 2 min before expiry (access token = 15 min)
  useEffect(() => {
    if (!accessToken) return
    const timer = setTimeout(refreshToken, 13 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [accessToken, refreshToken])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) return { ok: false, error: json.error ?? 'Login failed' }
      tokenRef.current = json.data.access_token
      setAccessToken(json.data.access_token)
      setUser(json.data.user)
      return { ok: true }
    },
    [],
  )

  const register = useCallback(
    async (data: { email: string; username: string; password: string; displayName?: string }) => {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return { ok: false, error: json.error ?? 'Registration failed' }
      tokenRef.current = json.data.access_token
      setAccessToken(json.data.access_token)
      setUser(json.data.user)
      return { ok: true }
    },
    [],
  )

  const logout = useCallback(async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
    tokenRef.current = null
    setAccessToken(null)
    setUser(null)
  }, [])

  return (
    <Ctx.Provider value={{ user, accessToken, loading, login, register, logout, refreshToken }}>
      {children}
    </Ctx.Provider>
  )
}
