import { Google, decodeIdToken } from 'arctic'
import { env } from '@/lib/env'
import type { GoogleClaims } from './account-resolution'

/** Returns null when Google SSO is not configured, so routes can 404 cleanly. */
export function getGoogleProvider(): Google | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null
  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/v1/auth/google/callback`
  return new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri)
}

export function createGoogleAuthUrl(google: Google, state: string, codeVerifier: string): URL {
  // openid + profile + email cover the claims we need (sub, email, name).
  return google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email'])
}

interface GoogleIdToken {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
}

/** Exchange the authorization code and decode the ID token into our claims shape. */
export async function validateGoogleCallback(
  google: Google,
  code: string,
  codeVerifier: string,
): Promise<GoogleClaims> {
  const tokens = await google.validateAuthorizationCode(code, codeVerifier)
  const claims = decodeIdToken(tokens.idToken()) as GoogleIdToken
  if (!claims.sub || !claims.email) {
    throw new Error('Google ID token missing sub/email')
  }
  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    emailVerified: claims.email_verified === true,
    name: claims.name,
  }
}
