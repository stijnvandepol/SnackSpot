// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Modal } from '../ui/modal'

function renderModal(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn()
  const utils = render(
    <Modal open onClose={onClose} title="Delete this?" {...props}>
      <button type="button">First</button>
      <button type="button">Second</button>
      <button type="button">Last</button>
    </Modal>,
  )
  return { onClose, ...utils }
}

describe('Modal', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <span>content</span>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exposes dialog semantics wired to the title', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)).toHaveTextContent('Delete this?')
  })

  it('moves focus into the dialog on open', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('closes on Escape', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on backdrop click but not on inner click', () => {
    const { onClose } = renderModal()
    const dialog = screen.getByRole('dialog')
    // Click inside the dialog: must NOT close.
    fireEvent.mouseDown(dialog)
    expect(onClose).not.toHaveBeenCalled()
    // Click the backdrop (the dialog's parent overlay): must close.
    fireEvent.mouseDown(dialog.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps focus: Tab on the last element wraps to the first', () => {
    renderModal()
    const buttons = screen.getAllByRole('button')
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('traps focus: Shift+Tab on the first element wraps to the last', () => {
    renderModal()
    const buttons = screen.getAllByRole('button')
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = renderModal()
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <Modal open={false} onClose={() => {}} title="Delete this?">
        <button type="button">First</button>
      </Modal>,
    )
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
