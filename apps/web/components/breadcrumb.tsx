import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

/**
 * Desktop-only breadcrumb trail. Hidden on mobile (md: breakpoint).
 * Last item has no href (current page). All others are links.
 * Example: [{ label: 'Explore', href: '/search' }, { label: 'Café Roma' }]
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-xs text-snack-muted mb-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden="true">›</span>}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-snack-text transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-snack-text font-medium' : ''}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
