// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The GET handler validates the `limit` query param at the boundary (parseQuery
// + Zod) before any DB access, so the 422 paths never reach prisma. For the
// happy path we stub prisma + the visibility helper to isolate limit handling.
const findUnique = vi.fn()
const findMany = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    review: { findUnique: (...a: unknown[]) => findUnique(...a) },
    comment: { findMany: (...a: unknown[]) => findMany(...a) },
  },
}))
vi.mock('@/lib/review-helpers', () => ({
  checkReviewVisibility: () => undefined,
  processCommentMentions: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { GET } from './route'

const URL = 'https://snackspot.online/api/v1/reviews/r1/comments'
const params = { params: Promise.resolve({ id: 'r1' }) }

function call(query = '') {
  return GET(new NextRequest(`${URL}${query}`), params)
}

describe('GET /api/v1/reviews/[id]/comments — limit validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findUnique.mockResolvedValue({ id: 'r1', status: 'PUBLISHED', userId: 'u1' })
    findMany.mockResolvedValue([])
  })

  it('rejects a non-numeric limit with 422 and never touches the DB', async () => {
    const res = await call('?limit=abc')
    expect(res.status).toBe(422)
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('rejects limit below the minimum (0) with 422', async () => {
    expect((await call('?limit=0')).status).toBe(422)
  })

  it('rejects limit above the maximum (51) with 422', async () => {
    expect((await call('?limit=51')).status).toBe(422)
  })

  it('accepts the boundary value 50 (what the UI sends)', async () => {
    const res = await call('?limit=50')
    expect(res.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
  })

  it('defaults to 20 when limit is omitted', async () => {
    const res = await call('')
    expect(res.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }))
  })
})
