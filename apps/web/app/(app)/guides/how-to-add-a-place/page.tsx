import type { Metadata } from 'next'
import Link from 'next/link'
import { safeJsonLd } from '@/lib/html'
import { RelatedGuides } from '@/components/related-guides'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const faqItems = [
  {
    question: 'Kan ik een snackplek toevoegen als nog niemand er een review over heeft geschreven?',
    answer:
      'Ja. Staat de snackplek nog niet op SnackSpot, dan kies je hem uit de zoekresultaten en wordt hij toegevoegd zodra je je review plaatst.',
  },
  {
    question: 'Waar komen de namen en adressen vandaan?',
    answer:
      'Uit OpenStreetMap. Daardoor hoef je zelf geen naam of adres in te typen en komen reviews van dezelfde zaak op één pagina terecht.',
  },
  {
    question: 'Moet ik een snackplek toevoegen voordat ik een review kan plaatsen?',
    answer:
      'Alleen als hij nog niet op SnackSpot staat. Staat hij er al op, kies hem dan uit de lijst en ga verder met je review.',
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

const TITLE = 'Een snackplek toevoegen op SnackSpot'
const DESCRIPTION =
  'Staat een snackbar of andere snackplek nog niet op SnackSpot? Zo voeg je hem toe terwijl je een review plaatst, in een paar stappen.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: '/guides/how-to-add-a-place',
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

export default function HowToAddAPlacePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <BreadcrumbJsonLd
        items={[
          { name: 'Uitleg', path: '/guides' },
          { name: 'Een snackplek toevoegen', path: '/guides/how-to-add-a-place' },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />

      <article className="guide-content guide-article prose prose-slate">
        <h1>Een snackplek toevoegen op SnackSpot</h1>

        <p>
          Staat de snackplek die je wilt reviewen nog niet op SnackSpot? Dan voeg je hem toe terwijl je je review
          plaatst. Zo komen reviews bij de juiste zaak terecht en kunnen anderen hem ook vinden.
        </p>

        <h2>Wanneer voeg je een snackplek toe?</h2>
        <ul>
          <li>De snackplek staat niet tussen de plekken die al op SnackSpot staan.</li>
          <li>Je hebt goed gezocht op naam en adres en vindt hem nog steeds niet.</li>
          <li>Het gaat om een echte zaak waar je zelf hebt gegeten.</li>
        </ul>

        <h2>Zo voeg je een snackplek toe</h2>
        <ol>
          <li>
            Begin met <Link href="/add-review">een review schrijven</Link> en ga naar de stap <strong>Snackplek</strong>.
          </li>
          <li>Zoek op de naam van de zaak. Vind je hem niet, zet dan de straat of plaats erbij.</li>
          <li>
            Plekken die al op SnackSpot staan, komen bovenaan. Plekken die er nog niet op staan, zijn in de lijst
            gemarkeerd als nieuw.
          </li>
          <li>Kies de juiste zaak. Controleer het adres onder de naam.</li>
          <li>Plaats je review. De snackplek wordt dan meteen toegevoegd.</li>
        </ol>

        <h2>Tips</h2>
        <ul>
          <li>Kijk eerst of de zaak al op SnackSpot staat, soms met een net iets andere schrijfwijze.</li>
          <li>Let op het adres als een zaak meerdere vestigingen heeft.</li>
          <li>Gebruik de knop voor plekken bij jou in de buurt als je er nu bent.</li>
        </ul>

        <h2>Wat gebeurt er daarna?</h2>
        <p>
          De nieuwe snackplek krijgt een eigen pagina met jouw review erop. Anderen kunnen dezelfde snackplek daarna
          gewoon kiezen als ze een review plaatsen.
        </p>
        <p>
          Nog nooit een review geplaatst? Lees <Link href="/guides/how-to-post-a-review">hoe je een review plaatst</Link>.
        </p>

        <h2>Veelgestelde vragen</h2>
        {faqItems.map((item) => (
          <section key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </section>
        ))}
      </article>

      <RelatedGuides currentHref="/guides/how-to-add-a-place" />
    </div>
  )
}
