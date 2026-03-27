import { getSiteUrl } from '@/lib/site-url'

interface BreadcrumbItem {
  name: string
  path?: string
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const appUrl = getSiteUrl()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: appUrl },
      ...items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: item.name,
        ...(item.path ? { item: `${appUrl}${item.path}` } : {}),
      })),
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
