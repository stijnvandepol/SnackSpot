import { env } from '@/lib/env'

/**
 * The IndexNow key file. Search engines fetch it (keyLocation in every ping) to confirm the
 * ping came from the site's owner; its body must be exactly the key.
 */
export function GET() {
  if (!env.INDEXNOW_KEY) return new Response('Not found', { status: 404 })
  return new Response(env.INDEXNOW_KEY, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  })
}
