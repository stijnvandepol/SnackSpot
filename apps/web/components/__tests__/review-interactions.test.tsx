// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ReviewInteractions } from '../review-interactions'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.PropsWithChildren<{ href: string; [key: string]: unknown }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('../auth-provider', () => ({
  useAuth: () => ({
    user: null,
    accessToken: null,
    loading: false,
  }),
}))

vi.mock('../review-like-button', () => ({
  ReviewLikeButton: ({ initialLikeCount }: { reviewId: string; initialLikeCount: number; initialLikedByMe: boolean }) => (
    <button data-testid="like-button">{initialLikeCount} likes</button>
  ),
}))

vi.mock('../avatar-lightbox', () => ({
  AvatarLightbox: ({ username }: { username: string }) => (
    <img alt={`${username} avatar`} data-testid="avatar" />
  ),
}))

vi.mock('../mention-text', () => ({
  MentionText: ({ text, className }: { text: string; className?: string }) => (
    <p className={className}>{text}</p>
  ),
}))

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseProps = {
  reviewId: 'review-1',
  reviewUserId: 'user-1',
  reviewUsername: 'foodie_nl',
  initialLikeCount: 12,
  initialCommentCount: 3,
  createdAt: new Date(Date.now() - 30_000).toISOString(),
  avatarKey: null,
  editHref: '/review/review-1/edit',
  isOwnerAllowed: false,
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReviewInteractions — comment count grammar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response)
    )
  })

  it('uses "comments" (plural) for 0 comments', () => {
    render(<ReviewInteractions {...baseProps} initialCommentCount={0} />)
    expect(screen.getByText('0 comments')).toBeInTheDocument()
  })

  it('uses "comment" (singular) for exactly 1 comment', () => {
    render(<ReviewInteractions {...baseProps} initialCommentCount={1} />)
    expect(screen.getByText('1 comment')).toBeInTheDocument()
  })

  it('uses "comments" (plural) for 2+ comments', () => {
    render(<ReviewInteractions {...baseProps} initialCommentCount={5} />)
    expect(screen.getByText('5 comments')).toBeInTheDocument()
  })
})
