// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BottomNav } from '../bottom-nav'

// vi.hoisted ensures these variables are available inside the vi.mock() factory,
// which is hoisted to the top of the module before any other declarations.
const mockUsePathname = vi.hoisted(() => vi.fn(() => '/'))

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
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

describe('BottomNav — link structure', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/')
  })

  it('renders all 5 navigation links', () => {
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explore' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create new post' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nearby' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
  })

  it('each link points to the correct href', () => {
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/search')
    expect(screen.getByRole('link', { name: 'Create new post' })).toHaveAttribute('href', '/add-review')
    expect(screen.getByRole('link', { name: 'Nearby' })).toHaveAttribute('href', '/nearby')
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
  })
})

describe('BottomNav — active state (aria-current)', () => {
  it('marks Home as current on "/"', () => {
    mockUsePathname.mockReturnValue('/')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark other links as current on "/"', () => {
    mockUsePathname.mockReturnValue('/')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Explore' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Nearby' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current')
  })

  it('marks Explore as current on "/search"', () => {
    mockUsePathname.mockReturnValue('/search')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('marks Nearby as current on "/nearby"', () => {
    mockUsePathname.mockReturnValue('/nearby')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Nearby' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks Profile as current on "/profile"', () => {
    mockUsePathname.mockReturnValue('/profile')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks Explore as current on a deep /search subpath', () => {
    // startsWith('/search') should match /search/something
    mockUsePathname.mockReturnValue('/search/deep')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page')
  })

  it('does NOT mark Home as current on "/search" (exact match)', () => {
    mockUsePathname.mockReturnValue('/search')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })
})

describe('BottomNav — "Post" button accessibility', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/')
    render(<BottomNav />)
  })

  it('Post link has aria-label "Create new post"', () => {
    expect(screen.getByRole('link', { name: 'Create new post' })).toBeInTheDocument()
  })

  it('Post link has a visually hidden label text', () => {
    // The sr-only span inside the Post link
    const srText = screen.getByText('Post')
    expect(srText).toHaveClass('sr-only')
  })
})
