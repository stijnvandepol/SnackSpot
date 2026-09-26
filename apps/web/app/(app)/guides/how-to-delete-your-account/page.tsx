import type { Metadata } from 'next'
import Link from 'next/link'
import { safeJsonLd } from '@/lib/html'
import { RelatedGuides } from '@/components/related-guides'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const faqItems = [
  {
    question: 'Is het verwijderen van mijn account definitief?',
    answer:
      'Ja. Je profiel, je reviews en al je andere gegevens worden voorgoed verwijderd. Je kunt ze daarna niet meer terughalen.',
  },
  {
    question: 'Wat gebeurt er met mijn reviews?',
    answer: 'Je reviews en alles wat je verder hebt geplaatst, worden samen met je account verwijderd.',
  },
  {
    question: 'Kan ik mijn gebruikersnaam later opnieuw gebruiken?',
    answer: 'Na het verwijderen komt je gebruikersnaam vrij. Iemand anders kan hem daarna ook kiezen.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
}

const TITLE = 'Je SnackSpot-account verwijderen'
const DESCRIPTION =
  'Zo verwijder je je SnackSpot-account en al je gegevens definitief via je profielinstellingen. Lees ook wat er met je reviews en foto’s gebeurt.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: '/guides/how-to-delete-your-account',
  },
  openGraph: {
    type: 'article',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/twitter-image'],
  },
}

export default function HowToDeleteYourAccountPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <BreadcrumbJsonLd
        items={[
          { name: 'Uitleg', path: '/guides' },
          { name: 'Je account verwijderen', path: '/guides/how-to-delete-your-account' },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />

      <article className="guide-content guide-article prose prose-slate">
        <h1>Je SnackSpot-account verwijderen</h1>

        <p>
          Je kunt je account verwijderen via je profielinstellingen. Daarmee verdwijnen je profiel, al je reviews en
          foto’s en alle andere gegevens van je account. Dit kun je niet terugdraaien.
        </p>

        <h2>Voordat je begint</h2>
        <p>
          Weet je zeker dat je je account wilt verwijderen? Je gegevens zijn daarna niet meer terug te halen. Wil je een
          kopie bewaren, download dan eerst je gegevens via Instellingen. Wil je alleen even pauze, dan kun je de app
          ook gewoon niet gebruiken. Je account blijft dan zoals het is.
        </p>

        <h2>Zo verwijder je je account</h2>
        <ol>
          <li>
            Zorg dat je bent <Link href="/auth/login">ingelogd</Link>.
          </li>
          <li>
            Ga naar je <Link href="/profile?tab=settings">profielinstellingen</Link>.
          </li>
          <li>Scrol naar onderen.</li>
          <li>
            Tik op <strong>Account verwijderen</strong>.
          </li>
          <li>Vul ter bevestiging je wachtwoord in. Log je in met Google, typ dan je gebruikersnaam.</li>
          <li>
            Tik nog een keer op <strong>Account verwijderen</strong>. Je account en al je gegevens worden direct
            verwijderd.
          </li>
        </ol>

        <h2>Veelgestelde vragen</h2>
        {faqItems.map((item) => (
          <section key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </section>
        ))}
      </article>

      <RelatedGuides currentHref="/guides/how-to-delete-your-account" />
    </div>
  )
}
