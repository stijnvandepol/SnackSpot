import type { Metadata } from 'next'
import Link from 'next/link'
import { RelatedGuides } from '@/components/RelatedGuides'

const faqItems = [
  {
    question: 'Kan ik SnackSpot op mijn startscherm zetten zonder app store?',
    answer:
      'Ja. Open SnackSpot in je browser en gebruik de optie Toevoegen aan startscherm of Add to Home Screen.',
  },
  {
    question: 'Waarom zie ik de optie “Toevoegen aan startscherm” niet?',
    answer:
      'Gebruik bij voorkeur Chrome op Android en Safari op iPhone, en open SnackSpot rechtstreeks in de browser in plaats van in een in-app browser.',
  },
  {
    question: 'Werkt dit op zowel Android als iOS?',
    answer:
      'Ja. De stappen zijn iets anders per platform, maar op beide kun je SnackSpot als icoon op je homescreen plaatsen.',
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

export const metadata: Metadata = {
  title: 'SnackSpot toevoegen aan je startscherm (Android & iPhone)',
  description:
    'Handleiding om SnackSpot op je mobiele startscherm te zetten op Android en iOS, inclusief snelle oplossingen bij problemen.',
  alternates: {
    canonical: '/guides/snackspot-toevoegen-aan-startscherm',
  },
}

export default function AddSnackSpotToHomescreenGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <article className="prose prose-slate max-w-none">
        <h1>SnackSpot toevoegen aan je startscherm (Android &amp; iPhone)</h1>

        <p>
          Je kunt SnackSpot gebruiken als snelle app-ervaring zonder iets uit een app store te installeren. Door SnackSpot
          aan je startscherm toe te voegen, open je het direct met één tik vanaf je homescreen.
        </p>
        <p>
          In deze gids vind je stap-voor-stap instructies voor Android en iOS, plus oplossingen voor de meest voorkomende
          problemen.
        </p>

        <h2>Voordelen van SnackSpot op je startscherm</h2>
        <h3>Sneller openen</h3>
        <p>
          Je hoeft niet eerst een browser te openen en opnieuw te zoeken. Het SnackSpot-icoon staat direct tussen je andere
          apps.
        </p>
        <h3>App-achtige ervaring</h3>
        <p>
          SnackSpot opent in een schone weergave met minder browser-afleiding, waardoor je sneller reviews en plekken kunt
          bekijken.
        </p>
        <h3>Praktisch voor dagelijks gebruik</h3>
        <p>
          Handig als je vaak wilt <Link href="/nearby">restaurants nearby ontdekken</Link>, de{' '}
          <Link href="/feed">laatste food reviews bekijken</Link> of direct naar <Link href="/search">zoeken</Link> wilt.
        </p>

        <h2>Android: SnackSpot toevoegen aan startscherm</h2>
        <h3>Methode 1: Google Chrome</h3>
        <ol>
          <li>Open Chrome op je Android-telefoon.</li>
          <li>Ga naar SnackSpot (bijvoorbeeld de home of feed).</li>
          <li>Tik rechtsboven op het menu met de drie puntjes.</li>
          <li>Kies <strong>Toevoegen aan startscherm</strong> (of <strong>Add to Home screen</strong>).</li>
          <li>Pas eventueel de naam aan naar “SnackSpot”.</li>
          <li>Tik op <strong>Toevoegen</strong> en bevestig.</li>
        </ol>

        <h3>Methode 2: Samsung Internet</h3>
        <ol>
          <li>Open Samsung Internet.</li>
          <li>Ga naar SnackSpot.</li>
          <li>Open het menu (meestal onder of boven).</li>
          <li>Kies <strong>Pagina toevoegen aan</strong> of <strong>Add page to</strong>.</li>
          <li>Selecteer <strong>Startscherm</strong>.</li>
          <li>Bevestig om het icoon toe te voegen.</li>
        </ol>

        <h3>Na het toevoegen op Android</h3>
        <p>
          Zoek het SnackSpot-icoon op je homescreen en tik erop. Je kunt het icoon daarna verplaatsen naar je dock of een
          map, net zoals bij andere apps.
        </p>

        <h2>iPhone (iOS): SnackSpot toevoegen aan startscherm</h2>
        <h3>Belangrijk: gebruik Safari</h3>
        <p>
          Op iPhone werkt “Toevoegen aan beginscherm” het best via Safari. In andere browsers of in-app browsers kan de
          optie ontbreken.
        </p>

        <h3>Stappen in Safari</h3>
        <ol>
          <li>Open Safari op je iPhone.</li>
          <li>Ga naar SnackSpot.</li>
          <li>Tik op de <strong>Deel</strong>-knop (vierkant met pijltje omhoog).</li>
          <li>Scroll in het deelmenu en kies <strong>Zet op beginscherm</strong>.</li>
          <li>Controleer de naam (bijvoorbeeld “SnackSpot”).</li>
          <li>Tik op <strong>Voeg toe</strong>.</li>
        </ol>

        <h3>Na het toevoegen op iPhone</h3>
        <p>
          Het SnackSpot-icoon staat nu op je beginscherm. Je kunt het icoon verplaatsen zoals elke andere app en eventueel
          in je dock zetten.
        </p>

        <h2>Probleemoplossing</h2>
        <h3>Optie niet zichtbaar</h3>
        <ul>
          <li>Gebruik Safari op iPhone en Chrome op Android.</li>
          <li>Open SnackSpot direct in de browser, niet in Instagram/Facebook/WhatsApp browser.</li>
          <li>Ververs de pagina en probeer opnieuw.</li>
        </ul>

        <h3>Icoon toegevoegd maar opent niet goed</h3>
        <ul>
          <li>Verwijder het icoon van je startscherm.</li>
          <li>Open SnackSpot opnieuw in de juiste browser.</li>
          <li>Voeg het opnieuw toe met de stappen hierboven.</li>
        </ul>

        <h3>Verouderde versie lijkt te blijven hangen</h3>
        <ul>
          <li>Sluit SnackSpot volledig en open opnieuw via het icoon.</li>
          <li>Ververs binnen SnackSpot handmatig.</li>
          <li>Als nodig: browsercache legen en opnieuw toevoegen.</li>
        </ul>

        <h2>Tips voor dagelijks gebruik</h2>
        <h3>Zet SnackSpot in je dock</h3>
        <p>
          Dan heb je altijd direct toegang, net als bij je meest gebruikte apps.
        </p>
        <h3>Gebruik SnackSpot als vaste eet-beslisflow</h3>
        <p>
          Start in <Link href="/search">zoek</Link>, check daarna <Link href="/nearby">nearby</Link>, en valideer je
          keuze in de <Link href="/feed">feed met echte reviews</Link>.
        </p>
        <h3>Maak een account voor snellere keuzes</h3>
        <p>
          Met een account kun je sneller terug naar je favoriete plekken en gewoontes. Je kunt je account maken via{' '}
          <Link href="/auth/register">registreren op SnackSpot</Link>.
        </p>

        <h2>Klaar om SnackSpot als app-icoon te gebruiken?</h2>
        <p>
          Als je de stappen hierboven volgt, heb je SnackSpot binnen een minuut op je startscherm. Daarna open je het net
          zo snel als een gewone app en kun je direct nieuwe lokale food spots ontdekken.
        </p>

        <h2>FAQ</h2>
        {faqItems.map((item) => (
          <section key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </section>
        ))}

        <section className="mt-8 rounded-2xl border border-snack-border bg-snack-surface p-5">
          <h3 className="m-0">Direct starten</h3>
          <p className="mt-3">
            Open <Link href="/nearby">find hidden gem restaurants near you</Link>, ga door naar{' '}
            <Link href="/search">discover restaurants nearby</Link>, en check daarna{' '}
            <Link href="/feed">see real food reviews on SnackSpot</Link>. Nog geen account?{' '}
            <Link href="/auth/register">Maak er hier één aan</Link>.
          </p>
        </section>
      </article>

      <RelatedGuides currentHref="/guides/snackspot-toevoegen-aan-startscherm" />
    </div>
  )
}
