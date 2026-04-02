import type { Metadata } from 'next'
import Link from 'next/link'
import { RelatedGuides } from '@/components/related-guides'
import { GuidesShell } from '@/components/guides-shell'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const faqItems = [
  {
    question: 'Is a SnackSpot account free?',
    answer: 'Yes. Creating an account is completely free.',
  },
  {
    question: 'What do I need to sign up?',
    answer: 'An email address, a username, and a password. No phone number or payment details required.',
  },
  {
    question: 'Can I use SnackSpot without an account?',
    answer:
      'You can browse the feed and search for places without an account. You need an account to post reviews, like posts, or leave comments.',
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

export const metadata: Metadata = {
  title: 'How to create a SnackSpot account',
  description:
    'Create a free SnackSpot account in under a minute. All you need is an email address and a username.',
  alternates: {
    canonical: '/guides/how-to-create-an-account',
  },
  openGraph: {
    type: 'article',
    title: 'How to create a SnackSpot account',
    description: 'Create a free SnackSpot account in under a minute. All you need is an email address and a username.',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to create a SnackSpot account',
    description: 'Create a free SnackSpot account in under a minute. All you need is an email address and a username.',
    images: ['/twitter-image'],
  },
}

export default function HowToCreateAnAccountPage() {
  return (
    <GuidesShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <BreadcrumbJsonLd items={[{ name: 'Guides', path: '/guides' }, { name: 'How to Create an Account', path: '/guides/how-to-create-an-account' }]} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <article className="guide-content guide-article prose prose-slate">
          <h1>How to create a SnackSpot account</h1>

          <p>
            Creating a SnackSpot account is free and takes under a minute. Once you have an account you can post reviews,
            like and comment on posts from others, and build your own profile of food spots.
          </p>

          <h2>What you need</h2>
          <ul>
            <li>A valid email address</li>
            <li>A username (this is public and appears on your posts)</li>
            <li>A password of your choice</li>
          </ul>

          <h2>Steps to create your account</h2>
          <ol>
            <li>
              Go to the <Link href="/auth/register">SnackSpot registration page</Link>.
            </li>
            <li>Enter your email address.</li>
            <li>Choose a username. This is shown publicly on your reviews and profile.</li>
            <li>Set a password.</li>
            <li>Click <strong>Create account</strong>.</li>
            <li>You are signed in immediately. Check your inbox for a verification email and click the link inside to confirm your address.</li>
          </ol>

          <h2>After creating your account</h2>
          <p>
            Once signed in you can start using SnackSpot straight away:
          </p>
          <ul>
            <li>
              <Link href="/add-review">Post your first review</Link> by tapping the Post button.
            </li>
            <li>
              <Link href="/">Browse the feed</Link> and like posts from other users.
            </li>
            <li>
              <Link href="/nearby">Discover places near you</Link> on the map.
            </li>
          </ul>

          <h2>FAQ</h2>
          {faqItems.map((item) => (
            <section key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </section>
          ))}
        </article>

        <RelatedGuides currentHref="/guides/how-to-create-an-account" />
      </div>
    </GuidesShell>
  )
}
