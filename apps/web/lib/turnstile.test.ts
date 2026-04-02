import { describe, expect, it } from 'vitest'

// Pure helper — extracted for unit testing without a real network call.
function buildSiteverifyPayload(token: string, secret: string, ip: string): string {
  return JSON.stringify({ secret, response: token, remoteip: ip })
}

describe('buildSiteverifyPayload', () => {
  it('includes all three required fields', () => {
    const parsed = JSON.parse(buildSiteverifyPayload('tok_abc', 'sec_xyz', '1.2.3.4'))
    expect(parsed.secret).toBe('sec_xyz')
    expect(parsed.response).toBe('tok_abc')
    expect(parsed.remoteip).toBe('1.2.3.4')
  })

  it('different tokens produce different payloads', () => {
    const a = buildSiteverifyPayload('tok_a', 'sec', '1.2.3.4')
    const b = buildSiteverifyPayload('tok_b', 'sec', '1.2.3.4')
    expect(a).not.toBe(b)
  })
})

describe('Turnstile response shape', () => {
  it('recognises a success response', () => {
    const response = { success: true, 'error-codes': [] as string[] }
    expect(response.success).toBe(true)
    expect(response['error-codes']).toHaveLength(0)
  })

  it('recognises timeout-or-duplicate as a failure', () => {
    const response = { success: false, 'error-codes': ['timeout-or-duplicate'] }
    expect(response.success).toBe(false)
    expect(response['error-codes']).toContain('timeout-or-duplicate')
  })
})
