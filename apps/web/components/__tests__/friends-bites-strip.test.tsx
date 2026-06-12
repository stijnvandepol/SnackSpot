// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FriendsBitesStrip } from '../feed-tabs'

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
    user: { id: 'u1', username: 'me' },
    accessToken: 'test-token',
    loading: false,
  }),
}))

vi.mock('../feed-client', () => ({
  FeedClient: () => null,
}))

const bite = {
  id: 'b1',
  mealSlot: 'SNACK',
  note: 'lekker',
  createdAt: '2026-06-12T08:00:00.000Z',
  user: { id: 'u2', username: 'foodie_nl', avatarKey: null },
  photo: { id: 'p1', variants: { thumb: 'photos/thumb/b1.webp', large: 'photos/large/b1.webp' } },
  place: { id: 'pl1', name: 'Frietje Piet' },
}

describe('FriendsBitesStrip', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { data: [bite] } }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the lightbox with poster info when a thumbnail is clicked, and closes on Escape', async () => {
    render(<FriendsBitesStrip />)
    const thumb = await screen.findByRole('button', { name: "View foodie_nl's bite photo" })
    fireEvent.click(thumb)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('link', { name: '@foodie_nl' })).toHaveAttribute(
      'href',
      '/u/foodie_nl',
    )
    expect(within(dialog).getByText('Frietje Piet')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
