'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Shows a locally picked image file without turning it into a URL string.
 *
 * The obvious `<img src={URL.createObjectURL(file)}>` is safe in practice (a blob: URL cannot
 * run script in an <img>), but CodeQL's js/xss-through-dom follows the file input into the
 * `src` attribute and flags it on every edit of that line. Decoding the file with
 * createImageBitmap and drawing it on a canvas removes the attribute sink altogether, and
 * frees the decoded bitmap instead of leaking object URLs.
 *
 * Draws "object-fit: cover" into the element's own box, at device-pixel resolution.
 */
export function FileImagePreview({
  file,
  label,
  className,
}: {
  file: File
  /** Accessible name; the canvas is exposed as role="img". */
  label: string
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let bitmap: ImageBitmap | null = null
    setFailed(false)

    createImageBitmap(file)
      .then((decoded) => {
        bitmap = decoded
        const canvas = canvasRef.current
        if (cancelled || !canvas) return
        const rect = canvas.getBoundingClientRect()
        const scale = window.devicePixelRatio || 1
        const width = Math.max(1, Math.round(rect.width * scale))
        const height = Math.max(1, Math.round(rect.height * scale))
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) return
        // Cover: scale to fill, then centre-crop the overflow.
        const ratio = Math.max(width / decoded.width, height / decoded.height)
        const drawWidth = decoded.width * ratio
        const drawHeight = decoded.height * ratio
        context.drawImage(decoded, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
      })
      .catch(() => {
        // Formats the browser cannot decode (e.g. HEIC outside Safari) still upload fine;
        // only the local preview is missing.
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      bitmap?.close()
    }
  }, [file])

  if (failed) {
    return (
      <div role="img" aria-label={label} className={`flex items-center justify-center text-4xl ${className ?? ''}`}>
        <span aria-hidden="true">📷</span>
      </div>
    )
  }

  return <canvas ref={canvasRef} role="img" aria-label={label} className={className} />
}
