// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('renders 4 navigation links and the create button', () => {
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ontdek' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review of bite plaatsen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dichtbij' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profiel' })).toBeInTheDocument()
  })

  it('each link points to the correct href', () => {
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Ontdek' })).toHaveAttribute('href', '/search')
    expect(screen.getByRole('link', { name: 'Dichtbij' })).toHaveAttribute('href', '/nearby')
    expect(screen.getByRole('link', { name: 'Profiel' })).toHaveAttribute('href', '/profile')
  })
})

describe('BottomNav — create sheet', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/')
    render(<BottomNav />)
  })

  it('opens the chooser with a Review and a Bite option', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Review of bite plaatsen' }))
    expect(screen.getByRole('dialog', { name: 'Review of bite plaatsen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review/ })).toHaveAttribute('href', '/add-review')
    expect(screen.getByRole('link', { name: /Bite/ })).toHaveAttribute('href', '/add-bite')
  })

  it('explains both options', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Review of bite plaatsen' }))
    expect(screen.getByText(/Openbaar en blijvend/)).toBeInTheDocument()
    expect(screen.getByText(/Vrienden zien hem 24 uur/)).toBeInTheDocument()
  })

  it('closes via the backdrop', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Review of bite plaatsen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
    expect(screen.getByRole('link', { name: 'Ontdek' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Dichtbij' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Profiel' })).not.toHaveAttribute('aria-current')
  })

  it('marks Explore as current on "/search"', () => {
    mockUsePathname.mockReturnValue('/search')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Ontdek' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('marks Nearby as current on "/nearby"', () => {
    mockUsePathname.mockReturnValue('/nearby')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Dichtbij' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks Profile as current on "/profile"', () => {
    mockUsePathname.mockReturnValue('/profile')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Profiel' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks Explore as current on a deep /search subpath', () => {
    // startsWith('/search') should match /search/something
    mockUsePathname.mockReturnValue('/search/deep')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Ontdek' })).toHaveAttribute('aria-current', 'page')
  })

  it('does NOT mark Home as current on "/search" (exact match)', () => {
    mockUsePathname.mockReturnValue('/search')
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })
})

describe('BottomNav — create button accessibility', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/')
    render(<BottomNav />)
  })

  it('create button announces the dialog it opens', () => {
    const button = screen.getByRole('button', { name: 'Review of bite plaatsen' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('create button has a visually hidden label text', () => {
    const srText = screen.getByText('Plaatsen')
    expect(srText).toHaveClass('sr-only')
  })
})
