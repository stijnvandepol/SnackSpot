import { ok, withNoStore } from '@/lib/api-helpers'

export async function GET() {
  return withNoStore(ok({ status: 'ok' }))
}
