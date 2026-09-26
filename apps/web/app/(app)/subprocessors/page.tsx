import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Subverwerkers',
  description:
    'De externe dienstverleners die namens SnackSpot gegevens kunnen verwerken: wat ze doen, welke gegevens ze krijgen en waar ze gevestigd zijn.',
  alternates: { canonical: '/subprocessors' },
}

// GDPR Art. 13(1)(e) transparency: the recipients/categories of recipients of
// personal data. Keep this list in sync with the services actually enabled in
// production (.env). "Conditional" entries only apply when that feature is on.
type SubProcessor = {
  name: string
  purpose: string
  data: string
  region: string
  conditional?: string
  link?: string // the provider's own privacy / data documentation
}

const SUBPROCESSORS: SubProcessor[] = [
  {
    name: 'Resend',
    purpose: 'Versturen van servicemails en e-mailmeldingen',
    data: 'E-mailadres, gebruikersnaam en de inhoud van het bericht',
    region: 'Verenigde Staten',
    link: 'https://resend.com/legal/privacy-policy',
  },
  {
    name: 'Cloudflare (Turnstile)',
    purpose: 'Bescherming tegen bots en misbruik bij inloggen en registreren',
    data: 'IP-adres en een verificatietoken',
    region: 'Verenigde Staten',
    conditional: 'Alleen als de CAPTCHA-controle aanstaat.',
    link: 'https://www.cloudflare.com/privacypolicy/',
  },
  {
    name: 'Google (Inloggen met Google)',
    purpose: 'Optioneel inloggen met je Google-account',
    data: 'Je e-mailadres en naam uit je Google-account, alleen als je voor deze optie kiest',
    region: 'Verenigde Staten',
    conditional: 'Alleen als je inlogt met Google.',
    link: 'https://policies.google.com/privacy',
  },
  {
    name: 'Pushdiensten van browsers (Google, Mozilla, Apple)',
    purpose: 'Afleveren van pushmeldingen op je apparaat',
    data: 'Een adres voor je pushabonnement en de inhoud van de melding',
    region: 'Verschilt per browsermaker',
    conditional: 'Alleen als je pushmeldingen aanzet.',
  },
  {
    name: 'CARTO',
    purpose: 'Leveren van de kaartachtergrond',
    data: 'Je IP-adres en het kaartgebied dat je bekijkt (verstuurd door je browser als er een kaart laadt)',
    region: 'Europese Unie en wereldwijd',
    link: 'https://carto.com/privacy/',
  },
]

export default function SubprocessorsPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-snack-text">Subverwerkers</h1>
        <p className="text-sm text-snack-muted mt-1">Laatst bijgewerkt: 25 september 2026</p>
      </div>

      <div className="card p-5 space-y-3">
        <p className="text-sm text-snack-muted">
          SnackSpot draait op eigen infrastructuur (database, opslag en cache), maar gebruikt voor
          sommige functies een klein aantal externe dienstverleners. Dat zijn systemen van derden die
          beperkte persoonsgegevens op hun eigen infrastructuur kunnen opslaan als je de bijbehorende
          functie gebruikt. We verkopen je gegevens niet. Wat elke dienstverlener precies verzamelt, lees
          je via de link &ldquo;Wat zij verzamelen&rdquo; bij elke dienst hieronder. Wat <em>wij</em>{' '}
          bewaren en waarom, staat in onze{' '}
          <Link href="/privacy" className="text-snack-primary hover:underline">privacyverklaring</Link>.
        </p>
        <p className="text-sm text-snack-muted">
          Is een dienstverlener gevestigd buiten de Europese Economische Ruimte, dan gebeurt de
          doorgifte op basis van de waarborgen van die dienstverlener zelf (zoals het EU-VS Data Privacy
          Framework of modelcontractbepalingen, zoals beschreven in hun privacydocumentatie).
        </p>
      </div>

      {SUBPROCESSORS.map((sp) => (
        <div key={sp.name} className="card p-5 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading font-semibold text-snack-text">{sp.name}</h2>
            <span className="shrink-0 text-xs text-snack-muted">{sp.region}</span>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="w-28 shrink-0 text-snack-text">Doel</dt>
              <dd className="text-snack-muted">{sp.purpose}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="w-28 shrink-0 text-snack-text">Gegevens</dt>
              <dd className="text-snack-muted">{sp.data}</dd>
            </div>
          </dl>
          {sp.conditional && (
            <p className="text-xs italic text-snack-muted">{sp.conditional}</p>
          )}
          {sp.link && (
            <a
              href={sp.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-xs font-medium text-snack-primary hover:underline"
            >
              Wat zij verzamelen →
            </a>
          )}
        </div>
      ))}

      <div className="card p-5 space-y-2">
        <h2 className="font-heading font-semibold text-snack-text">Gegevens van snackplekken</h2>
        <p className="text-sm text-snack-muted">
          Namen, adressen en kaartgegevens van zaken komen van{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-snack-primary hover:underline">OpenStreetMap</a>{' '}
          (&copy; OpenStreetMap-bijdragers, ODbL). Zoekopdrachten naar plekken gaan via onze servers,
          dus je persoonsgegevens worden niet gedeeld met OpenStreetMap.
        </p>
      </div>
    </div>
  )
}
