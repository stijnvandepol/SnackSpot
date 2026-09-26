import type { Metadata } from 'next'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'
import { MarketingShell } from '@/components/marketing-shell'
import { resolveLocale, getMarketingDict, ogLocale } from '@/lib/i18n/locale'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale()
  const t = getMarketingDict(locale).releasesChrome
  return {
    title: { absolute: t.metaTitle },
    description: t.metaDescription,
    alternates: { canonical: '/product/releases' },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      title: t.metaTitle,
      description: t.metaDescription,
      locale: ogLocale(locale),
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title: t.metaTitle,
      description: t.metaDescription,
      images: ['/twitter-image'],
    },
  }
}

type ChangeType = 'new' | 'improved' | 'fixed' | 'removed'

interface Change {
  type: ChangeType
  text: string
}

interface Release {
  version: string
  date: string
  summary: string
  changes: Change[]
}

const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; className: string }> = {
  new:      { label: 'Nieuw',      className: 'bg-green-100 text-green-700' },
  improved: { label: 'Verbeterd',  className: 'bg-blue-100 text-blue-700' },
  fixed:    { label: 'Opgelost',   className: 'bg-amber-100 text-amber-700' },
  removed:  { label: 'Verwijderd', className: 'bg-red-100 text-red-700' },
}

// Add new releases at the top of this array.
const releases: Release[] = [
  {
    version: '2.0.0',
    date: '18 juni 2026',
    summary: 'Productsite in twee talen, juridische pagina’s en een overzichtelijkere opbouw.',
    changes: [
      { type: 'new',      text: 'De productsite is er nu in het Nederlands en Engels. Rechtsboven wissel je van taal.' },
      { type: 'new',      text: 'Juridische pagina’s toegevoegd: voorwaarden, privacyverklaring, een lijst met subverwerkers en bedrijfsgegevens.' },
      { type: 'new',      text: 'Bij het aanmaken van een account bevestig je nu dat je de minimumleeftijd hebt.' },
      { type: 'improved', text: 'Overzichtelijkere opbouw: handleidingen staan nu op /guides en updates op /product/releases. Oude links sturen je automatisch door, dus bestaande bladwijzers blijven werken.' },
      { type: 'improved', text: 'Pagina’s van snackplekken vermelden nu OpenStreetMap als bron van locatie- en kaartgegevens.' },
    ],
  },
  {
    version: '1.4.0',
    date: '2 april 2026',
    summary: 'Meldingen per e-mail, een vaste opmaak voor de feed en bugfixes.',
    changes: [
      { type: 'new',      text: 'Meldingen per e-mail voor likes, reacties, vermeldingen en nieuwe badges.' },
      { type: 'new',      text: 'Vaste opmaak voor berichten in de feed: elke review toont nu gerecht, snackplek, cijfer, tags en aantal likes op dezelfde manier.' },
      { type: 'new',      text: 'Eigen voorbeeldafbeeldingen bij het delen van snackplekken, reviews en profielen.' },
      { type: 'new',      text: 'Pagina met updates toegevoegd, zodat je kunt zien wat er verandert.' },
      { type: 'improved', text: 'Nieuwe likeknop met een hartje dat zich vult, zoals je gewend bent van andere sociale apps.' },
      { type: 'improved', text: 'Likes kloppen nu weer als je de app opnieuw opent.' },
      { type: 'improved', text: 'Pagina met statistieken en prestaties vernieuwd: met uitleg bij elke badge en één lijst voor behaalde en lopende badges.' },
      { type: 'improved', text: 'De paginatitel van een snackplek bevat nu de stad, zodat je hem beter vindt in zoekmachines.' },
      { type: 'fixed',    text: 'Likes verdwenen na het opnieuw openen van de app. De feed wacht nu tot je sessie is hersteld voordat hij laadt.' },
      { type: 'fixed',    text: 'Vaste kleuren op de pagina’s voor reviews plaatsen, zoeken, meldingen en profiel vervangen door kleuren die ook in de donkere modus werken.' },
      { type: 'removed',  text: 'Instellingen voor pushmeldingen verwijderd, omdat pushmeldingen nooit goed werkten.' },
    ],
  },
  {
    version: '1.3.0',
    date: '14 maart 2026',
    summary: 'Donkere modus en verificatiebadges.',
    changes: [
      { type: 'new',      text: 'Donkere modus in de hele app. Zet hem aan in je profielinstellingen.' },
      { type: 'new',      text: 'Verificatiebadge op profielen van betrouwbare reviewers.' },
      { type: 'improved', text: 'Beheer: de titel en tekst van een review zijn nu direct aan te passen vanuit het dashboard.' },
      { type: 'fixed',    text: 'Vaste kleuren in de hele app vervangen door designtokens, zodat alles goed werkt in de donkere modus.' },
    ],
  },
  {
    version: '1.2.0',
    date: '1 maart 2026',
    summary: 'Badges, meldingen en een snellere app.',
    changes: [
      { type: 'new',      text: 'Badges in brons, zilver en goud, voor het aantal berichten, reeksen, ontvangen likes en bezochte plekken.' },
      { type: 'new',      text: 'Meldingenbel in de app voor likes, reacties, vermeldingen en nieuwe badges.' },
      { type: 'improved', text: 'Foto’s uploaden werkt beter, met een terugvaloptie en duidelijkere foutmeldingen.' },
      { type: 'improved', text: 'De feed laadt sneller bij doorscrollen.' },
    ],
  },
]

export default async function ReleasesPage() {
  const locale = await resolveLocale()
  const dict = getMarketingDict(locale)

  return (
    <MarketingShell locale={locale} dict={dict}>
      <BreadcrumbJsonLd items={[{ name: 'Updates', path: '/product/releases' }]} />

      <div className="mx-auto max-w-3xl px-4 py-16 md:py-24">
        <div className="mb-12">
          <p className="mb-4 inline-flex rounded-full border border-snack-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-snack-primary">
            {dict.releasesChrome.eyebrow}
          </p>
          <h1 className="font-heading text-4xl font-bold leading-tight text-snack-text md:text-5xl">
            {dict.releasesChrome.title}
          </h1>
          <p className="mt-4 text-base leading-7 text-snack-muted">
            {dict.releasesChrome.intro}
          </p>
        </div>

        <ol className="relative border-l border-snack-border">
          {releases.map((release) => (
            <li key={release.version} className="mb-12 ml-6">
              <span
                className="absolute -left-2.5 mt-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-snack-primary shadow-sm"
                aria-hidden="true"
              />

              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="rounded-full bg-snack-primary px-3 py-0.5 text-xs font-bold text-white">
                  v{release.version}
                </span>
                <time className="text-sm text-snack-muted">{release.date}</time>
              </div>

              <p className="mb-4 text-base font-semibold text-snack-text">{release.summary}</p>

              <ul className="space-y-2">
                {release.changes.map((change, i) => {
                  const config = CHANGE_TYPE_CONFIG[change.type]
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
                        {config.label}
                      </span>
                      <span className="text-sm leading-5 text-snack-text">{change.text}</span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </MarketingShell>
  )
}
