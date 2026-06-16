export interface GoogleClaims {
  sub: string
  email: string
  emailVerified: boolean
  name?: string
}

export interface ResolutionContext {
  /** userId of an existing Account(provider='google', providerAccountId=sub), if any */
  linkedUserId: string | null
  /** userId of an existing User with this email, if any */
  userIdByEmail: string | null
  /** whether the user matched by link or email is banned */
  bannedByEmail: boolean
}

export type AccountAction =
  | { type: 'login'; userId: string }
  | { type: 'link'; userId: string }
  | { type: 'create' }
  | { type: 'reject'; reason: 'email_unverified' | 'banned' }

/** Decide what to do with a Google identity. Pure: all I/O happens in the route. */
export function decideAccountAction(claims: GoogleClaims, ctx: ResolutionContext): AccountAction {
  // 1. Already linked → straight login (banned check first).
  if (ctx.linkedUserId) {
    if (ctx.bannedByEmail) return { type: 'reject', reason: 'banned' }
    return { type: 'login', userId: ctx.linkedUserId }
  }
  // 2. No link → require a Google-verified email before trusting it.
  if (!claims.emailVerified) return { type: 'reject', reason: 'email_unverified' }
  // 3. Email matches an existing account → auto-link (banned check first).
  if (ctx.userIdByEmail) {
    if (ctx.bannedByEmail) return { type: 'reject', reason: 'banned' }
    return { type: 'link', userId: ctx.userIdByEmail }
  }
  // 4. Brand-new user.
  return { type: 'create' }
}
