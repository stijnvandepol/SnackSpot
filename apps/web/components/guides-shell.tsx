import { resolveLocale, getMarketingDict } from '@/lib/i18n/locale'
import { MarketingShell } from './marketing-shell'

export async function GuidesShell({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocale()
  const dict = getMarketingDict(locale)
  return <MarketingShell locale={locale} dict={dict}>{children}</MarketingShell>
}
