'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export interface AuthUser {
  id: string
  email: string
  username: string
  bio: string | null
  avatarKey: string | null
  usernameChangedAt: string | null
  role: string
}

interface AuthCtx {
  user: AuthUser | null
  accessToken: string | null
  loading: boolean
  login(email: string, password: string, captchaToken?: string): Promise<{ ok: boolean; error?: string; captchaRequired?: boolean }>
  register(data: {
    email: string
    username: string
    password: string
  }): Promise<{ ok: boolean; error?: string }>
  logout(): Promise<void>
  refreshToken(): Promise<boolean>
  reloadMe(): Promise<boolean>
}

const isDev = process.env.NODE_ENV !== 'production'

const Ctx = createContext<AuthCtx | null>(null)

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** Like useAuth but returns null when used outside AuthProvider instead of throwing.
 *  Use this for components that render safely without an authenticated session. */
export function useAuthOptional(): AuthCtx | null {
  return useContext(Ctx)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const tokenRef = useRef<string | null>(null)

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000) // 15 sec timeout

      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        // Token-rotation race: two browser tabs can call /refresh simultaneously.
        // The first rotates the cookie; the second arrives with the now-invalid
        // old cookie and gets a 401. A short wait lets the first response commit,
        // so a single retry with the updated cookie succeeds.
        const ROTATION_RACE_RETRY_MS = 250
        if (res.status === 401) {
          await new Promise((resolve) => setTimeout(resolve, ROTATION_RACE_RETRY_MS))
          const retryRes = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
          if (retryRes.ok) {
            const { data } = await retryRes.json()
            tokenRef.current = data.access_token
            setAccessToken(data.access_token)
            return true
          }
        }

        // 401/403 after retry = auth session really invalid.
        if (res.status === 401 || res.status === 403) {
          if (isDev) console.error('[AUTH] Refresh failed:', res.status, res.statusText)
          const hadUser = !!tokenRef.current
          setUser(null)
          setAccessToken(null)
          tokenRef.current = null
          // Redirect to login with expired param so the page can show a message
          if (hadUser && typeof window !== 'undefined') {
            window.location.href = '/auth/login?expired=1'
          }
        } else {
          if (isDev) console.warn('[AUTH] Refresh returned non-auth error:', res.status)
        }
        return false
      }
      const { data } = await res.json()
      tokenRef.current = data.access_token
      setAccessToken(data.access_token)
      return true
    } catch (e) {
      if (isDev) console.error('[AUTH] Refresh error:', e)
      // Don't logout on network errors - just fail gracefully
      return false
    }
  }, [])

  // On mount: try to refresh (restores session from httpOnly cookie)
  useEffect(() => {
    const restoreSession = async () => {
      const ok = await refreshToken()
      if (ok && tokenRef.current) {
        try {
          const res = await fetch('/api/v1/auth/me', {
            credentials: 'include',
            headers: { Authorization: `Bearer ${tokenRef.current}` },
          })
          if (res.ok) {
            const { data } = await res.json()
            setUser(data)
            if (isDev) console.debug('[AUTH] Session restored')
          } else {
            if (isDev) console.warn('[AUTH] /auth/me failed:', res.status)
          }
        } catch (e) {
          if (isDev) console.error('[AUTH] Failed to fetch user:', e)
        }
      }
      setLoading(false)
    }
    restoreSession()
  }, [refreshToken])

  // Proactively refresh 2 min before expiry (access token = 15 min)
  useEffect(() => {
    if (!accessToken) return
    const timer = setTimeout(() => refreshToken(), 13 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [accessToken, refreshToken])

  const login = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            ...(captchaToken ? { captchaToken } : {}),
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          return {
            ok: false,
            error: json.error ?? 'Login failed',
            captchaRequired: json.captchaRequired === true,
          }
        }
        tokenRef.current = json.data.access_token
        setAccessToken(json.data.access_token)
        setUser(json.data.user)
        return { ok: true }
      } catch {
        return { ok: false, error: 'Network error' }
      }
    },
    [],
  )

  const register = useCallback(
    async (data: { email: string; username: string; password: string }) => {
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

  const reloadMe = useCallback(async (): Promise<boolean> => {
    if (!tokenRef.current) return false

    try {
      const res = await fetch('/api/v1/auth/me', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
      if (!res.ok) return false
      const { data } = await res.json()
      setUser(data)
      return true
    } catch {
      return false
    }
  }, [])

  return (
    <Ctx.Provider value={{ user, accessToken, loading, login, register, logout, refreshToken, reloadMe }}>
      {children}
    </Ctx.Provider>
  )
}
