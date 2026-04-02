import type { Metadata } from 'next'
import Link from 'next/link'
import { RelatedGuides } from '@/components/related-guides'
import { GuidesShell } from '@/components/guides-shell'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const faqItems = [
  {
    question: 'Do I need an account to post a review?',
    answer: 'Yes. You need a SnackSpot account to post. Creating one is free and takes under a minute.',
  },
  {
    question: 'Can I edit or delete a review after posting?',
    answer:
      'Yes. Open the review from your profile, tap the edit button, make your changes, and save. To delete, open the review and select the delete option.',
  },
  {
    question: 'How many photos can I add to a review?',
    answer: 'You can add up to 5 photos per review.',
  },
  {
    question: 'What if the place I want to review is not on SnackSpot?',
    answer:
      'You can add the place yourself during the review flow. See the guide on how to add a place for step-by-step instructions.',
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
  title: 'How to post a review on SnackSpot',
  description:
    'Share a photo review of a local food spot on SnackSpot. Step-by-step instructions for posting your first review.',
  alternates: {
    canonical: '/guides/how-to-post-a-review',
  },
  openGraph: {
    type: 'article',
    title: 'How to post a review on SnackSpot',
    description: 'Share a photo review of a local food spot on SnackSpot. Step-by-step instructions for posting your first review.',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to post a review on SnackSpot',
    description: 'Share a photo review of a local food spot on SnackSpot. Step-by-step instructions for posting your first review.',
    images: ['/twitter-image'],
  },
}

export default function HowToPostAReviewPage() {
  return (
    <GuidesShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <BreadcrumbJsonLd items={[{ name: 'Guides', path: '/guides' }, { name: 'How to Post a Review', path: '/guides/how-to-post-a-review' }]} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <article className="guide-content guide-article prose prose-slate">
          <h1>How to post a review on SnackSpot</h1>

          <p>
            Posting a review on SnackSpot lets you share a food spot with others — add photos, rate the experience, and
            write a short description so other users know what to expect.
          </p>

          <h2>What you need</h2>
          <ul>
            <li>A SnackSpot account (<Link href="/guides/how-to-create-an-account">create one here</Link> if you do not have one)</li>
            <li>At least one photo of the food or place</li>
            <li>The name of the place you visited</li>
          </ul>

          <h2>Steps to post a review</h2>
          <ol>
            <li>
              Tap the <strong>Post</strong> button in the navigation bar, or go to{' '}
              <Link href="/add-review">add a review</Link> directly.
            </li>
            <li>
              Search for the place you want to review. Type the name or address in the search field.
              If the place is not on SnackSpot yet, you can add it —{' '}
              <Link href="/guides/how-to-add-a-place">see the guide on adding a place</Link>.
            </li>
            <li>Select the correct place from the results.</li>
            <li>Add one or more photos. You can upload up to 5 images.</li>
            <li>
              Enter the name of the dish or item you ordered (optional but recommended — it helps others know what to get).
            </li>
            <li>Give a rating by selecting the number of stars.</li>
            <li>Write a short description of your experience.</li>
            <li>
              Click <strong>Post review</strong>. Your review will appear in the feed and on the place page.
            </li>
          </ol>

          <h2>After posting</h2>
          <p>
            Your review appears immediately on the <Link href="/">feed</Link> and on the place page. Other users
            can like it, comment on it, and use it to decide where to eat.
          </p>
          <p>
            You can edit or delete your review at any time by opening it from your profile.
          </p>

          <h2>FAQ</h2>
          {faqItems.map((item) => (
            <section key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </section>
          ))}
        </article>

        <RelatedGuides currentHref="/guides/how-to-post-a-review" />
      </div>
    </GuidesShell>
  )
}
