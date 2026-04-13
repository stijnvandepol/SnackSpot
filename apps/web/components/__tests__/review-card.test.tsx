// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ReviewCard } from '../review-card'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

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

// ReviewLikeButton needs auth context — replace with a lightweight stub
vi.mock('../review-like-button', () => ({
  ReviewLikeButton: ({ initialLikeCount }: { reviewId: string; initialLikeCount: number }) => (
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

vi.mock('../verified-badge', () => ({
  VerifiedBadge: ({ className }: { className?: string }) => (
    <span data-testid="verified-badge" className={className} aria-label="Verified" />
  ),
}))

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseReview = {
  id: 'review-1',
  rating: 4,
  overallRating: 4,
  text: 'Great fries and friendly staff — really worth it.',
  dishName: 'Friet Speciaal',
  createdAt: new Date(Date.now() - 30_000).toISOString(), // renders as "zojuist"
  user: {
    id: 'user-1',
    username: 'foodie_nl',
    avatarKey: null,
    isVerified: false,
  },
  place: {
    id: 'place-1',
    name: 'Snackbar De Hoek',
    address: 'Kerkstraat 1, 1234 AB Amsterdam',
  },
  likeCount: 12,
  commentCount: 3,
  likedByMe: false,
  reviewPhotos: [],
}

// ─── Content rendering ────────────────────────────────────────────────────────

describe('ReviewCard — content', () => {
  beforeEach(() => {
    render(<ReviewCard review={baseReview} />)
  })

  it('renders the dish name', () => {
    expect(screen.getByText('Friet Speciaal')).toBeInTheDocument()
  })

  it('renders the review text', () => {
    expect(screen.getByText('Great fries and friendly staff — really worth it.')).toBeInTheDocument()
  })

  it('renders the author username', () => {
    expect(screen.getByText('foodie_nl')).toBeInTheDocument()
  })

  it('renders the formatted overall rating', () => {
    expect(screen.getByText('4.0')).toBeInTheDocument()
  })

  it('renders the comment count', () => {
    expect(screen.getByText('3 comments')).toBeInTheDocument()
  })

  it('renders the like button with the correct count', () => {
    expect(screen.getByTestId('like-button')).toHaveTextContent('12 likes')
  })
})

// ─── Place visibility ─────────────────────────────────────────────────────────

describe('ReviewCard — place visibility', () => {
  it('shows the place name when showPlace=true (default)', () => {
    render(<ReviewCard review={baseReview} showPlace={true} />)
    expect(screen.getByText('Snackbar De Hoek')).toBeInTheDocument()
  })

  it('hides the place name when showPlace=false', () => {
    render(<ReviewCard review={baseReview} showPlace={false} />)
    expect(screen.queryByText('Snackbar De Hoek')).not.toBeInTheDocument()
  })
})

// ─── Comment count grammar ────────────────────────────────────────────────────

describe('ReviewCard — comment count singular / plural', () => {
  it('uses "comments" (plural) for 0 comments', () => {
    render(<ReviewCard review={{ ...baseReview, commentCount: 0 }} />)
    expect(screen.getByText('0 comments')).toBeInTheDocument()
  })

  it('uses "comment" (singular) for exactly 1 comment', () => {
    render(<ReviewCard review={{ ...baseReview, commentCount: 1 }} />)
    expect(screen.getByText('1 comment')).toBeInTheDocument()
  })

  it('uses "comments" (plural) for 2+ comments', () => {
    render(<ReviewCard review={{ ...baseReview, commentCount: 5 }} />)
    expect(screen.getByText('5 comments')).toBeInTheDocument()
  })
})

// ─── Review link ──────────────────────────────────────────────────────────────

describe('ReviewCard — review link', () => {
  it('links to /review/<id>', () => {
    render(<ReviewCard review={baseReview} />)
    const link = screen.getByRole('link', { name: /open review/i })
    expect(link).toHaveAttribute('href', '/review/review-1')
  })

  it('appends ?from=<backContext> when backContext is provided', () => {
    render(<ReviewCard review={baseReview} backContext="feed" />)
    const link = screen.getByRole('link', { name: /open review/i })
    expect(link).toHaveAttribute('href', '/review/review-1?from=feed')
  })

  it('URL-encodes the backContext value', () => {
    render(<ReviewCard review={baseReview} backContext="my feed" />)
    const link = screen.getByRole('link', { name: /open review/i })
    expect(link).toHaveAttribute('href', '/review/review-1?from=my%20feed')
  })
})

// ─── Verified badge ───────────────────────────────────────────────────────────

describe('ReviewCard — verified badge', () => {
  it('shows the verified badge for verified users', () => {
    render(<ReviewCard review={{ ...baseReview, user: { ...baseReview.user, isVerified: true } }} />)
    expect(screen.getByTestId('verified-badge')).toBeInTheDocument()
  })

  it('hides the verified badge for non-verified users', () => {
    render(<ReviewCard review={baseReview} />)
    expect(screen.queryByTestId('verified-badge')).not.toBeInTheDocument()
  })
})

// ─── Review photo ─────────────────────────────────────────────────────────────

describe('ReviewCard — review photo', () => {
  const reviewWithPhoto = {
    ...baseReview,
    reviewPhotos: [{ photo: { id: 'p1', variants: { thumb: 'photos/thumb.jpg' } } }],
  }

  it('renders the photo img element when reviewPhotos is provided', () => {
    render(<ReviewCard review={reviewWithPhoto} />)
    expect(screen.getByAltText('Friet Speciaal')).toBeInTheDocument()
  })

  it('uses the dish name as the alt text for the photo', () => {
    render(<ReviewCard review={reviewWithPhoto} />)
    const img = screen.getByAltText('Friet Speciaal')
    expect(img.tagName).toBe('IMG')
  })

  it('falls back to "Review photo" as alt text when dishName is null', () => {
    render(
      <ReviewCard
        review={{
          ...reviewWithPhoto,
          dishName: null,
          reviewPhotos: [{ photo: { id: 'p1', variants: { thumb: 'photos/thumb.jpg' } } }],
        }}
      />,
    )
    expect(screen.getByAltText('Review photo')).toBeInTheDocument()
  })

  it('does not render a review photo img when reviewPhotos is empty', () => {
    render(<ReviewCard review={baseReview} />)
    // Only the avatar img should be present
    const images = screen.getAllByRole('img')
    expect(images.every((img) => img.getAttribute('alt')?.includes('avatar'))).toBe(true)
  })
})
