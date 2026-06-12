// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BiteLightbox, type BiteLightboxBite } from '../bite-lightbox'

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

const baseBite: BiteLightboxBite = {
  mealSlot: 'LUNCH',
  createdAt: '2026-06-10T12:00:00.000Z',
  note: 'Beste broodje van de stad',
  photo: { variants: { large: 'photos/large/abc.webp', thumb: 'photos/thumb/abc.webp' } },
  place: { name: 'Broodje Bram' },
}

describe('BiteLightbox', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  it('renders nothing without a bite', () => {
    render(<BiteLightbox bite={null} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders nothing when the photo has no usable variant', () => {
    render(<BiteLightbox bite={{ ...baseBite, photo: { variants: {} } }} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the large photo variant with meal, date, place and note', () => {
    render(<BiteLightbox bite={baseBite} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute(
      'src',
      expect.stringContaining(encodeURIComponent('photos/large/abc.webp')),
    )
    expect(screen.getByText(/Lunch/)).toBeInTheDocument()
    expect(screen.getByText(/10 Jun 2026/)).toBeInTheDocument()
    expect(screen.getByText('Broodje Bram')).toBeInTheDocument()
    expect(screen.getByText('Beste broodje van de stad')).toBeInTheDocument()
  })

  it('links to the poster profile when user is provided', () => {
    render(
      <BiteLightbox bite={{ ...baseBite, user: { username: 'foodie_nl' } }} onClose={() => {}} />,
    )
    const link = screen.getByRole('link', { name: '@foodie_nl' })
    expect(link).toHaveAttribute('href', '/u/foodie_nl')
  })

  it('omits the profile link without user', () => {
    render(<BiteLightbox bite={baseBite} onClose={() => {}} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('closes on Escape, backdrop click and close button, but not on inner click', () => {
    const onClose = vi.fn()
    render(<BiteLightbox bite={baseBite} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    // Click inside the photo/info area: must NOT close.
    fireEvent.click(screen.getByRole('img'))
    expect(onClose).toHaveBeenCalledTimes(1)
    // Click the backdrop (the dialog element itself): must close.
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Close photo viewer' }))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(<BiteLightbox bite={baseBite} onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
