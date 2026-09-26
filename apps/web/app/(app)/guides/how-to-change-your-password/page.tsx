import type { Metadata } from 'next'
import Link from 'next/link'
import { safeJsonLd } from '@/lib/html'
import { RelatedGuides } from '@/components/related-guides'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const faqItems = [
  {
    question: 'Ik heb geen mail ontvangen. Wat nu?',
    answer:
      'Kijk in je map met spam of ongewenste mail. Staat de mail er na een paar minuten nog niet, vraag dan opnieuw een link aan met hetzelfde e-mailadres.',
  },
  {
    question: 'Hoe lang is de link geldig?',
    answer:
      'De link verloopt na korte tijd. Is hij verlopen, vraag dan een nieuwe aan via de pagina Wachtwoord vergeten.',
  },
  {
    question: 'Ik kan niet meer bij mijn e-mailadres.',
    answer:
      'Dan kun je je wachtwoord niet via de gewone weg opnieuw instellen. Mail ons op contact@snackspot.online, dan kijken we wat er kan.',
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

const TITLE = 'Je wachtwoord wijzigen op SnackSpot'
const DESCRIPTION =
  'Wachtwoord vergeten of wil je een nieuw wachtwoord? Zo stel je je SnackSpot-wachtwoord opnieuw in, plus wat je doet als de mail niet aankomt.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: '/guides/how-to-change-your-password',
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

export default function HowToChangeYourPasswordPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <BreadcrumbJsonLd
        items={[
          { name: 'Uitleg', path: '/guides' },
          { name: 'Je wachtwoord wijzigen', path: '/guides/how-to-change-your-password' },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />

      <article className="guide-content guide-article prose prose-slate">
        <h1>Je wachtwoord wijzigen op SnackSpot</h1>

        <p>
          Wachtwoord vergeten of wil je een nieuw wachtwoord instellen? SnackSpot stuurt je een link naar het
          e-mailadres van je account. Via die link kies je een nieuw wachtwoord.
        </p>

        <h2>Zo stel je een nieuw wachtwoord in</h2>
        <ol>
          <li>
            Ga naar de pagina <Link href="/auth/forgot-password">Wachtwoord vergeten</Link>.
          </li>
          <li>Vul het e-mailadres in waarmee je je account hebt gemaakt.</li>
          <li>
            Tik op <strong>Link versturen</strong>.
          </li>
          <li>Open de mail van SnackSpot en tik op de link.</li>
          <li>Vul je nieuwe wachtwoord twee keer in.</li>
          <li>
            Tik op <strong>Wachtwoord opslaan</strong>.
          </li>
        </ol>

        <h2>Daarna</h2>
        <p>
          Ga naar <Link href="/auth/login">Inloggen</Link> en log in met je e-mailadres en je nieuwe wachtwoord.
        </p>

        <h2>Veelgestelde vragen</h2>
        {faqItems.map((item) => (
          <section key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </section>
        ))}
      </article>

      <RelatedGuides currentHref="/guides/how-to-change-your-password" />
    </div>
  )
}
