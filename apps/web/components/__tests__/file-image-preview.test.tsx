// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { FileImagePreview } from '../file-image-preview'

const file = new File(['not really an image'], 'meal.jpg', { type: 'image/jpeg' })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('FileImagePreview', () => {
  it('renders a canvas with an accessible name and no URL attribute', () => {
    vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise(() => {})))
    render(<FileImagePreview file={file} label="Je maaltijd" />)
    const preview = screen.getByRole('img', { name: 'Je maaltijd' })
    expect(preview.tagName).toBe('CANVAS')
    expect(preview.getAttribute('src')).toBeNull()
  })

  it('decodes the picked file itself', () => {
    const decode = vi.fn(() => new Promise(() => {}))
    vi.stubGlobal('createImageBitmap', decode)
    render(<FileImagePreview file={file} label="Je maaltijd" />)
    expect(decode).toHaveBeenCalledWith(file)
  })

  it('falls back to a placeholder when the browser cannot decode the file', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.reject(new Error('unsupported'))))
    render(<FileImagePreview file={file} label="Je maaltijd" />)
    await waitFor(() => expect(screen.getByRole('img', { name: 'Je maaltijd' }).tagName).toBe('DIV'))
  })
})
