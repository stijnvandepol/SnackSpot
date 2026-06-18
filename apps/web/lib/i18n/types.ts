export type Locale = 'en' | 'nl'

// Single source of truth for marketing copy. en.ts and nl.ts must both satisfy
// this interface, so a missing translation key is a compile error.
export interface MarketingDict {
  meta: { productTitle: string; productDescription: string; productSocialTitle: string; productSocialDescription: string }
  hero: { eyebrow: string; title: string; subtitle: string; ctaPrimary: string; ctaSecondary: string; finePrint: string }
  features: Array<{ title: string; body: string; icon: string }>
  steps: Array<{ step: string; title: string; body: string }>
  faqs: Array<{ q: string; a: string }>
  community: { eyebrow: string; title: string; body: string; tagline: string; ctaAdd: string; ctaExplore: string }
  nav: { problem: string; features: string; why: string; guides: string; releases: string; login: string; createAccount: string }
  switcher: { label: string; en: string; nl: string }
  guidesHub: { title: string; intro: string }
  releasesChrome: { title: string; intro: string }
}
