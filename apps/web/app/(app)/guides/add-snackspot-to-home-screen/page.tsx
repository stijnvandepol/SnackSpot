import type { Metadata } from 'next'
import Link from 'next/link'
import { safeJsonLd } from '@/lib/html'
import { RelatedGuides } from '@/components/related-guides'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const faqItems = [
  {
    question: 'Kan ik SnackSpot op mijn beginscherm zetten zonder app store?',
    answer: 'Ja. Open SnackSpot in je browser en zet het via het browsermenu op je beginscherm. Je krijgt dan een icoon zoals bij een app.',
  },
  {
    question: 'Waarom zie ik de optie voor het beginscherm niet?',
    answer:
      'Gebruik Chrome op Android of Safari op de iPhone, en open SnackSpot direct in de browser en niet via een link in een andere app.',
  },
  {
    question: 'Werkt dit op Android en op de iPhone?',
    answer:
      'Ja. De stappen verschillen per telefoon, maar op allebei kun je SnackSpot op je beginscherm zetten.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}

const TITLE = 'SnackSpot op je beginscherm zetten (iPhone en Android)'
const DESCRIPTION =
  'Zet SnackSpot als icoon op het beginscherm van je iPhone of Android-telefoon. Met stappen per browser en oplossingen als het niet lukt.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: '/guides/add-snackspot-to-home-screen',
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

export default function AddSnackSpotToHomescreenGuidePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <BreadcrumbJsonLd
        items={[
          { name: 'Uitleg', path: '/guides' },
          { name: 'SnackSpot op je beginscherm', path: '/guides/add-snackspot-to-home-screen' },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />

      <article className="guide-content guide-article prose prose-slate">
        <h1>SnackSpot op je beginscherm zetten (iPhone en Android)</h1>

        <p>
          Je hoeft niets te downloaden uit een app store. Zet SnackSpot op je beginscherm en open het daarna met één
          tik, net als een app.
        </p>
        <p>Hieronder staan de stappen voor Android en iPhone, en wat je doet als het niet lukt.</p>

        <h2>Waarom op je beginscherm?</h2>
        <h3>Sneller openen</h3>
        <p>Je hoeft niet elke keer je browser te openen en het adres in te typen. SnackSpot staat tussen je andere apps.</p>
        <h3>Meer ruimte op je scherm</h3>
        <p>SnackSpot opent zonder adresbalk en knoppen van de browser, zodat je reviews en snackplekken beter ziet.</p>
        <h3>Handig onderweg</h3>
        <p>
          Snel <Link href="/nearby">snackplekken in de buurt</Link> bekijken, <Link href="/">de nieuwste reviews</Link>{' '}
          lezen of <Link href="/search">een snackbar zoeken</Link>.
        </p>

        <h2>Android</h2>
        <h3>Met Google Chrome</h3>
        <ol>
          <li>Open Chrome op je telefoon.</li>
          <li>Ga naar SnackSpot.</li>
          <li>Tik rechtsboven op het menu met de drie puntjes.</li>
          <li>
            Kies <strong>Toevoegen aan startscherm</strong>.
          </li>
          <li>Pas de naam eventueel aan naar “SnackSpot”.</li>
          <li>
            Tik op <strong>Toevoegen</strong> en bevestig.
          </li>
        </ol>

        <h3>Met Samsung Internet</h3>
        <ol>
          <li>Open Samsung Internet.</li>
          <li>Ga naar SnackSpot.</li>
          <li>Open het menu van de browser.</li>
          <li>
            Kies <strong>Pagina toevoegen aan</strong> en daarna <strong>Startscherm</strong>.
          </li>
          <li>Bevestig om het icoon te plaatsen.</li>
        </ol>

        <h3>Daarna</h3>
        <p>Tik op het SnackSpot-icoon op je startscherm om het te openen. Je kunt het verplaatsen of in een map zetten.</p>

        <h2>iPhone</h2>
        <h3>Gebruik Safari</h3>
        <p>
          Op de iPhone werkt dit het best in Safari. In de browser van andere apps en in sommige andere browsers ontbreekt
          de optie.
        </p>

        <h3>Stappen in Safari</h3>
        <ol>
          <li>Open Safari.</li>
          <li>Ga naar SnackSpot.</li>
          <li>
            Tik op de <strong>deelknop</strong> (het vierkantje met het pijltje omhoog).
          </li>
          <li>
            Scrol omlaag en tik op <strong>Zet op beginscherm</strong>.
          </li>
          <li>Controleer de naam, bijvoorbeeld “SnackSpot”.</li>
          <li>
            Tik op <strong>Voeg toe</strong>.
          </li>
        </ol>

        <h3>Daarna</h3>
        <p>SnackSpot staat nu op je beginscherm. Je kunt het verplaatsen zoals elke andere app, ook naar je dock.</p>

        <h2>Lukt het niet?</h2>
        <h3>De optie voor het beginscherm ontbreekt</h3>
        <ul>
          <li>Gebruik Safari op de iPhone en Chrome op Android.</li>
          <li>Open SnackSpot direct in de browser, niet via Instagram, Facebook of WhatsApp.</li>
          <li>Ververs de pagina en probeer het opnieuw.</li>
        </ul>

        <h3>Het icoon staat erop, maar opent niet goed</h3>
        <ul>
          <li>Verwijder het icoon van je beginscherm.</li>
          <li>Open SnackSpot opnieuw in de juiste browser.</li>
          <li>Zet het er opnieuw op met de stappen hierboven.</li>
        </ul>

        <h3>SnackSpot toont oude informatie</h3>
        <ul>
          <li>Sluit SnackSpot en open het opnieuw via het icoon.</li>
          <li>Ververs de pagina in SnackSpot.</li>
          <li>Helpt dat niet, wis dan de cache van je browser en zet SnackSpot opnieuw op je beginscherm.</li>
        </ul>

        <h2>Veelgestelde vragen</h2>
        {faqItems.map((item) => (
          <section key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </section>
        ))}

        <section className="mt-8 rounded-2xl border border-snack-border bg-snack-surface p-5">
          <h3 className="m-0">Aan de slag</h3>
          <p className="mt-3">
            Bekijk <Link href="/nearby">snackplekken in de buurt</Link>,{' '}
            <Link href="/search">zoek een snackbar</Link> of lees <Link href="/">de nieuwste reviews</Link>. Nog geen
            account? <Link href="/auth/register">Maak er hier een</Link>.
          </p>
        </section>
      </article>

      <RelatedGuides currentHref="/guides/add-snackspot-to-home-screen" />
    </div>
  )
}
