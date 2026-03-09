export function shouldUseDirectBrowserUpload(uploadUrl: string): boolean {
  if (typeof window === 'undefined') return true

  try {
    const target = new URL(uploadUrl, window.location.href)
    return target.origin !== window.location.origin
  } catch {
    return true
  }
}
