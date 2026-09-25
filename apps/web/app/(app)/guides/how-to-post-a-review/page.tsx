import type { Metadata } from 'next'
import Link from 'next/link'
import { safeJsonLd } from '@/lib/html'
import { RelatedGuides } from '@/components/related-guides'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const faqItems = [
  {
    question: 'Heb ik een account nodig om een review te plaatsen?',
    answer: 'Ja. Een account is gratis en snel gemaakt.',
  },
  {
    question: 'Kan ik een review aanpassen of verwijderen?',
    answer:
      'Ja. Open de review vanaf je profiel. Daar kun je hem bewerken of verwijderen. Een verwijderde review kun je 30 dagen lang terugzetten via je instellingen.',
  },
  {
    question: 'Hoeveel foto’s kan ik toevoegen?',
    answer: 'Maximaal 5 foto’s per review.',
  },
  {
    question: 'Wat als de snackplek nog niet op SnackSpot staat?',
    answer:
      'Dan voeg je hem toe terwijl je de review plaatst. In de handleiding over een snackplek toevoegen lees je hoe.',
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

const TITLE = 'Een review plaatsen op SnackSpot'
const DESCRIPTION =
  'Zo plaats je een review met foto’s op SnackSpot: foto’s toevoegen, sterren geven voor smaak, prijs en portie, en de snackplek kiezen.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: '/guides/how-to-post-a-review',
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

export default function HowToPostAReviewPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <BreadcrumbJsonLd
        items={[
          { name: 'Uitleg', path: '/guides' },
          { name: 'Een review plaatsen', path: '/guides/how-to-post-a-review' },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />

      <article className="guide-content guide-article prose prose-slate">
        <h1>Een review plaatsen op SnackSpot</h1>

        <p>
          Een review gaat over één gerecht bij één snackplek. Je voegt foto’s toe, geeft sterren en schrijft een paar
          zinnen, zodat anderen weten wat ze kunnen verwachten.
        </p>

        <h2>Wat je nodig hebt</h2>
        <ul>
          <li>
            Een SnackSpot-account (<Link href="/guides/how-to-create-an-account">maak er hier een</Link> als je dat nog
            niet hebt)
          </li>
          <li>Minstens één foto van je eten</li>
          <li>De naam van de snackplek waar je was</li>
        </ul>

        <h2>Zo plaats je een review</h2>
        <ol>
          <li>
            Tik op de plusknop (+) in het menu en kies voor een review, of ga direct naar{' '}
            <Link href="/add-review">een review schrijven</Link>.
          </li>
          <li>
            <strong>Foto’s:</strong> voeg 1 tot 5 foto’s van je eten toe.
          </li>
          <li>
            <strong>Beoordeling:</strong> geef sterren voor smaak, prijs-kwaliteit en portie. Service is optioneel.
          </li>
          <li>Vul de naam van het gerecht in, zodat anderen weten wat ze moeten bestellen.</li>
          <li>Schrijf een paar zinnen over je ervaring.</li>
          <li>
            <strong>Snackplek:</strong> zoek de snackplek op naam of adres en kies hem uit de lijst. Staat hij er nog
            niet op? <Link href="/guides/how-to-add-a-place">Lees hoe je een snackplek toevoegt</Link>.
          </li>
          <li>
            Tik op <strong>Review plaatsen</strong>.
          </li>
        </ol>

        <h2>Richtlijnen voor reviews</h2>
        <ul>
          <li>Wees eerlijk, ook als het tegenviel. Kritiek mag, als die klopt.</li>
          <li>Schrijf alleen over je eigen ervaring: iets wat je zelf hebt gegeten.</li>
          <li>Gebruik je eigen foto’s.</li>
          <li>Geen reclame en geen betaalde reviews zonder dat te vermelden.</li>
          <li>Geen persoonlijke aanvallen op medewerkers, eigenaren of andere gebruikers.</li>
        </ul>
        <p>
          De volledige regels staan in de <Link href="/terms">voorwaarden</Link>.
        </p>

        <h2>Na het plaatsen</h2>
        <p>
          Je review staat direct in de <Link href="/">feed</Link> en op de pagina van de snackplek. Anderen kunnen hem
          liken en erop reageren.
        </p>
        <p>Je kunt je review altijd aanpassen of verwijderen door hem te openen vanaf je profiel.</p>

        <h2>Veelgestelde vragen</h2>
        {faqItems.map((item) => (
          <section key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </section>
        ))}
      </article>

      <RelatedGuides currentHref="/guides/how-to-post-a-review" />
    </div>
  )
}
