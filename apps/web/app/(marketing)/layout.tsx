import { resolveLocale } from '@/lib/i18n/locale'

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocale()
  return <div lang={locale}>{children}</div>
}
