import { describe, it, expect } from 'vitest'
import { decideAccountAction } from './account-resolution'

const claims = { sub: 'g-123', email: 'a@b.com', emailVerified: true, name: 'Ann' }

describe('decideAccountAction', () => {
  it('logs in the linked user when a Google account already exists', () => {
    const action = decideAccountAction(claims, {
      linkedUserId: 'u1',
      userIdByEmail: null,
      bannedByEmail: false,
    })
    expect(action).toEqual({ type: 'login', userId: 'u1' })
  })

  it('rejects when Google has not verified the email and no link exists', () => {
    const action = decideAccountAction(
      { ...claims, emailVerified: false },
      { linkedUserId: null, userIdByEmail: null, bannedByEmail: false },
    )
    expect(action).toEqual({ type: 'reject', reason: 'email_unverified' })
  })

  it('auto-links to an existing verified-email account', () => {
    const action = decideAccountAction(claims, {
      linkedUserId: null,
      userIdByEmail: 'u2',
      bannedByEmail: false,
    })
    expect(action).toEqual({ type: 'link', userId: 'u2' })
  })

  it('creates a new user when nothing matches', () => {
    const action = decideAccountAction(claims, {
      linkedUserId: null,
      userIdByEmail: null,
      bannedByEmail: false,
    })
    expect(action).toEqual({ type: 'create' })
  })

  it('rejects a banned user even with a valid link', () => {
    const action = decideAccountAction(claims, {
      linkedUserId: 'u1',
      userIdByEmail: 'u1',
      bannedByEmail: true,
    })
    expect(action).toEqual({ type: 'reject', reason: 'banned' })
  })
})
