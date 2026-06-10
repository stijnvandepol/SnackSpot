import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { noContent, err, requireAuth, serverError, isResponse } from '@/lib/api-helpers'

// DELETE /api/v1/bites/[id] — remove an own bite. The photo itself is left to
// the unused-image cleanup job once nothing references it anymore.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(req)
  if (isResponse(auth)) return auth
  const { id } = await params

  try {
    const bite = await prisma.bite.findUnique({ where: { id }, select: { userId: true } })
    if (!bite || bite.userId !== auth.sub) return err('Bite not found', 404)

    await prisma.$transaction([
      prisma.bite.delete({ where: { id } }),
      prisma.userStats.updateMany({
        where: { userId: auth.sub, bitesCount: { gt: 0 } },
        data: { bitesCount: { decrement: 1 } },
      }),
    ])

    return noContent()
  } catch (e) {
    return serverError('bites DELETE', e)
  }
}
