export type Locale = 'en' | 'nl'

// Single source of truth for marketing copy. en.ts and nl.ts must both satisfy
// this interface, so a missing translation key is a compile error.
//
// Strings with `{name}` placeholders are filled with fillTemplate() in the page; the
// dictionary stays plain data so both languages remain diffable side by side.
export interface MarketingDict {
  meta: { productTitle: string; productDescription: string; productSocialTitle: string; productSocialDescription: string }
  product: {
    heroTitle: string
    heroLead: string
    ctaPrimary: string
    ctaSecondary: string
    heroFinePrint: string
    /** Placeholders: {reviews} {places} {cities} */
    counts: string

    stripTitle: string
    stripAll: string

    rankingTitle: string
    rankingBody: string
    /** Placeholders: {dish} {city} */
    rankingCaption: string
    rankingLink: string
    reviewsOne: string
    /** Placeholder: {n} */
    reviewsMany: string

    claims: Array<{ title: string; body: string }>

    stepsTitle: string
    steps: Array<{ title: string; body: string }>

    citiesTitle: string
    citiesBody: string
    citiesAll: string
    placesOne: string
    /** Placeholder: {n} */
    placesMany: string

    faqTitle: string
    faqs: Array<{ q: string; a: string }>

    finalTitle: string
    finalBody: string
    finalButton: string
    finalFinePrint: string
  }
  nav: { howItWorks: string; cities: string; guides: string; releases: string; login: string; createAccount: string }
  footer: { terms: string; privacy: string; subprocessors: string; imprint: string }
  switcher: { label: string; en: string; nl: string }
  releasesChrome: { title: string; intro: string; metaTitle: string; metaDescription: string; eyebrow: string }
}

/** Replace `{name}` placeholders. Missing keys are left in place so they show up in review. */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
}
