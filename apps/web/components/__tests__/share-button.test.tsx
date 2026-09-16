// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ShareButton } from '../share-button'

const props = {
  url: '/review/abc123',
  title: 'Kapsalon bij De Smickel',
  text: 'Kapsalon bij De Smickel in Uden — 4,5★ op SnackSpot',
}

describe('ShareButton', () => {
  const originalShare = navigator.share

  beforeEach(() => {
    // jsdom has no Web Share API; start every test from the fallback path.
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true, writable: true })
  })

  it('renders a compact icon button with an accessible label by default', () => {
    render(<ShareButton {...props} />)
    expect(screen.getByRole('button', { name: 'Delen: Kapsalon bij De Smickel' })).toBeInTheDocument()
  })

  it('renders a labelled button for the button variant', () => {
    render(<ShareButton {...props} variant="button" />)
    expect(screen.getByRole('button', { name: 'Delen' })).toBeInTheDocument()
  })

  it('uses the native share sheet when the browser has one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })

    render(<ShareButton {...props} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(share).toHaveBeenCalledWith({
      title: props.title,
      text: props.text,
      url: `${window.location.origin}/review/abc123`,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the WhatsApp / copy-link dialog when there is no native share', async () => {
    render(<ShareButton {...props} />)
    fireEvent.click(screen.getByRole('button'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Deel deze review')

    const whatsapp = screen.getByRole('link', { name: /Delen via WhatsApp/ })
    const href = whatsapp.getAttribute('href') ?? ''
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(href)).toContain(`${window.location.origin}/review/abc123`)
    expect(decodeURIComponent(href)).toContain(props.text)
  })

  it('falls back to the dialog when the native share fails for a reason other than dismissal', async () => {
    const share = vi.fn().mockRejectedValue(new TypeError('unsupported'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })

    render(<ShareButton {...props} />)
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('stays quiet when the user dismisses the native sheet', async () => {
    const abort = new Error('dismissed')
    abort.name = 'AbortError'
    const share = vi.fn().mockRejectedValue(abort)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })

    render(<ShareButton {...props} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('copies the absolute link to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(<ShareButton {...props} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(await screen.findByRole('button', { name: 'Kopieer link' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/review/abc123`))
    expect(await screen.findByText('Link gekopieerd ✓')).toBeInTheDocument()
  })
})
