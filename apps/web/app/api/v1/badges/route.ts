import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api-helpers'

export async function GET() {
  try {
    const badges = await prisma.badge.findMany({
      where: { isActive: true },
      orderBy: [{ criteriaValue: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        iconKey: true,
        tier: true,
        criteriaType: true,
        criteriaValue: true,
      },
    })

    return ok({ data: badges })
  } catch (e) {
    return serverError('badges GET', e)
  }
}
