import Link from 'next/link'
import { PILLAR_GUIDES } from '@/lib/guides'

interface RelatedGuidesProps {
  currentHref: string
  maxItems?: number
}

export function RelatedGuides({ currentHref, maxItems = 4 }: RelatedGuidesProps) {
  const guides = PILLAR_GUIDES.filter((guide) => guide.href !== currentHref).slice(0, maxItems)

  if (guides.length === 0) return null

  return (
    <aside className="mt-10 rounded-2xl border border-snack-border bg-white p-6">
      <h2 className="font-heading text-xl font-semibold text-snack-text">Related Guides</h2>
      <p className="mt-1 text-sm text-snack-muted">
        Continue learning with practical playbooks for finding better local food.
      </p>
      <ul className="mt-4 space-y-3">
        {guides.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href} className="text-sm font-medium text-snack-primary hover:underline">
              {guide.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  )
}
