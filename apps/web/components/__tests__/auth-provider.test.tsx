// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { AuthProvider, useAuth } from '../auth-provider'

function TestChild() {
  const { loading } = useAuth()
  return <div>{loading ? 'loading' : 'done'}</div>
}

describe('AuthProvider — refresh retry', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('doet maar 1 refresh request als er geen sessie was (tokenRef was null)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    render(
      <AuthProvider>
        <TestChild />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByText('done')).toBeInTheDocument())

    const refreshCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('/api/v1/auth/refresh')
    )
    expect(refreshCalls).toHaveLength(1)
  })
})
