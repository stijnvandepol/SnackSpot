// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: { user: { findMany: (...a: unknown[]) => findMany(...a) } },
}))

import { NextRequest } from 'next/server'
import { GET } from './route'

const URL = 'https://snackspot.online/api/v1/users/exists'
const call = (query = '') => GET(new NextRequest(`${URL}${query}`))
const body = async (res: Response) => (await res.json()).data

describe('GET /api/v1/users/exists — query validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findMany.mockResolvedValue([])
  })

  it('rejects an oversized usernames param with 422', async () => {
    const huge = 'a'.repeat(2001)
    const res = await call(`?usernames=${huge}`)
    expect(res.status).toBe(422)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('returns an empty list without hitting the DB when no usernames are given', async () => {
    const res = await call('')
    expect(res.status).toBe(200)
    expect(await body(res)).toEqual({ existing: [] })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('filters out malformed usernames before querying', async () => {
    // "a" (too short) and "bad name!" (illegal chars) are dropped by the pattern;
    // nothing valid remains, so it short-circuits without a DB call.
    const res = await call('?usernames=a,bad name!')
    expect(res.status).toBe(200)
    expect(await body(res)).toEqual({ existing: [] })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('returns existing usernames lowercased for valid input', async () => {
    findMany.mockResolvedValue([{ username: 'Alice' }])
    const res = await call('?usernames=alice,bob')
    expect(res.status).toBe(200)
    expect(await body(res)).toEqual({ existing: ['alice'] })
    expect(findMany).toHaveBeenCalledTimes(1)
  })
})
