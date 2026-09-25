import type { Metadata } from 'next'
import Link from 'next/link'
import { safeJsonLd } from '@/lib/html'
import { RelatedGuides } from '@/components/related-guides'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const faqItems = [
  {
    question: 'Is een SnackSpot-account gratis?',
    answer: 'Ja, een account maken is helemaal gratis.',
  },
  {
    question: 'Wat heb ik nodig om me aan te melden?',
    answer: 'Een e-mailadres, een gebruikersnaam en een wachtwoord. Je hoeft geen telefoonnummer of betaalgegevens op te geven.',
  },
  {
    question: 'Kan ik SnackSpot gebruiken zonder account?',
    answer:
      'Je kunt de feed bekijken en snackplekken zoeken zonder account. Voor reviews plaatsen, liken of reageren heb je een account nodig.',
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

const TITLE = 'Een account maken op SnackSpot'
const DESCRIPTION =
  'Maak een gratis SnackSpot-account met je e-mailadres of Google-account. Daarna kun je reviews plaatsen, liken en snackplekken bewaren.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: '/guides/how-to-create-an-account',
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

export default function HowToCreateAnAccountPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <BreadcrumbJsonLd
        items={[
          { name: 'Uitleg', path: '/guides' },
          { name: 'Een account maken', path: '/guides/how-to-create-an-account' },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />

      <article className="guide-content guide-article prose prose-slate">
        <h1>Een account maken op SnackSpot</h1>

        <p>
          Een SnackSpot-account is gratis en snel gemaakt. Met een account kun je reviews plaatsen, reviews van anderen
          liken en erop reageren, en snackplekken bewaren.
        </p>

        <h2>Wat je nodig hebt</h2>
        <ul>
          <li>Een geldig e-mailadres</li>
          <li>Een gebruikersnaam (die is openbaar en staat bij je reviews)</li>
          <li>Een wachtwoord van minstens 8 tekens, met een hoofdletter en een cijfer</li>
          <li>Je moet 16 jaar of ouder zijn</li>
        </ul>

        <h2>Zo maak je een account</h2>
        <ol>
          <li>
            Ga naar de pagina <Link href="/auth/register">Account maken</Link>.
          </li>
          <li>Vul je e-mailadres in.</li>
          <li>Kies een gebruikersnaam. Die is voor iedereen zichtbaar bij je reviews en op je profiel.</li>
          <li>Kies een wachtwoord.</li>
          <li>Bevestig dat je 16 jaar of ouder bent en akkoord gaat met de voorwaarden.</li>
          <li>
            Tik op <strong>Account aanmaken</strong>. Je bent daarna meteen ingelogd.
          </li>
        </ol>
        <p>Liever geen nieuw wachtwoord? Kies dan <strong>Verder met Google</strong> op dezelfde pagina.</p>

        <h2>Na het aanmaken</h2>
        <p>Je kunt meteen aan de slag:</p>
        <ul>
          <li>
            <Link href="/add-review">Plaats je eerste review</Link> via de plusknop (+).
          </li>
          <li>
            <Link href="/">Bekijk de feed</Link> en like reviews van anderen.
          </li>
          <li>
            <Link href="/nearby">Bekijk snackplekken bij jou in de buurt</Link> op de kaart.
          </li>
        </ul>

        <h2>Veelgestelde vragen</h2>
        {faqItems.map((item) => (
          <section key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </section>
        ))}
      </article>

      <RelatedGuides currentHref="/guides/how-to-create-an-account" />
    </div>
  )
}
