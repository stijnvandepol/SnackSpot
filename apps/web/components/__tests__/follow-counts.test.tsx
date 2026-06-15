// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FollowCounts } from '../follow-counts'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.PropsWithChildren<{ href: string; [k: string]: unknown }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}))

vi.mock('../auth-provider', () => ({
  useAuth: () => ({ user: null, accessToken: 'tok', loading: false }),
}))

vi.mock('../verified-badge', () => ({
  VerifiedBadge: () => <span data-testid="verified" />,
}))

function mockFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/follow?') || url.endsWith('/follow')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { followerCount: 2, followingCount: 1, following: false, followsMe: false },
          }),
      } as Response)
    }
    if (url.includes('/followers')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              data: [{ username: 'bob', avatarKey: null, isVerified: false, bio: null, viewerFollows: false }],
              pagination: { nextCursor: null, hasMore: false },
            },
          }),
      } as Response)
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`))
  })
}

describe('FollowCounts', () => {
  beforeEach(() => {
    global.fetch = mockFetch() as unknown as typeof fetch
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the followers list as a valid dialog (not nested inside a <p>)', async () => {
    render(<FollowCounts username="alice" />)

    // Counts load and render as clickable triggers.
    const followersTrigger = await screen.findByRole('button', { name: /2 followers/i })

    fireEvent.click(followersTrigger)

    const dialog = await screen.findByRole('dialog')
    // Regression guard: a block-level dialog must never be a descendant of a <p>,
    // which produces invalid DOM nesting and a React hydration mismatch.
    expect(dialog.closest('p')).toBeNull()

    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument())
  })
})
