import type { Metadata } from 'next'
import Link from 'next/link'
import { RelatedGuides } from '@/components/related-guides'
import { GuidesShell } from '@/components/guides-shell'
import { BreadcrumbJsonLd } from '@/components/breadcrumb-jsonld'

const faqItems = [
  {
    question: 'Can I add a place even if I am the first person reviewing it?',
    answer:
      'Yes. If the place does not appear in search during the review flow, you can create it yourself and continue posting your review.',
  },
  {
    question: 'What details should I add for a new place?',
    answer:
      'Add the official place name and the most accurate address possible so other people can find it and post about the same location.',
  },
  {
    question: 'Do I need to add a place before I can post?',
    answer:
      'Only if the place is not already listed. If it exists in SnackSpot search results, select it and continue with your review.',
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
  title: 'How to add a place or restaurant on SnackSpot',
  description:
    'Add a new place or restaurant on SnackSpot during the posting flow when the location is not listed yet.',
  alternates: {
    canonical: '/guides/how-to-add-a-place',
  },
}

export default function HowToAddAPlacePage() {
  return (
    <GuidesShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <BreadcrumbJsonLd items={[{ name: 'Guides', path: '/guides' }, { name: 'How to Add a Place', path: '/guides/how-to-add-a-place' }]} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <article className="guide-content guide-article prose prose-slate">
          <h1>How to add a place or restaurant on SnackSpot</h1>

          <p>
            If the place you want to review is not listed yet, you can add it during the posting flow. This keeps reviews
            organised under the correct location and makes the place discoverable for other users.
          </p>

          <h2>When you should add a new place</h2>
          <ul>
            <li>The place does not appear in SnackSpot search results.</li>
            <li>You checked the name and address carefully and still cannot find it.</li>
            <li>You want to post a review for a real location that has not been added yet.</li>
          </ul>

          <h2>How to add a place</h2>
          <ol>
            <li>
              Open the <Link href="/add-review">post a review</Link> flow.
            </li>
            <li>Search for the place by name or address first.</li>
            <li>If no correct result appears, choose the option to add a new place.</li>
            <li>Enter the place name exactly as it is used publicly.</li>
            <li>Add the most complete address you can.</li>
            <li>Save the place and continue with your review.</li>
          </ol>

          <h2>Tips for better place data</h2>
          <ul>
            <li>Use the official business name instead of a nickname.</li>
            <li>Double-check the spelling before saving.</li>
            <li>Use the correct street address so the place appears in the right area.</li>
            <li>Avoid adding duplicates if the place already exists under a slightly different spelling.</li>
          </ul>

          <h2>What happens next</h2>
          <p>
            After saving the place, you can finish your review immediately. Your review will be linked to the new place,
            and future users can select the same place when they post.
          </p>
          <p>
            If you have not posted before, read <Link href="/guides/how-to-post-a-review">how to post a review</Link> for
            the full step-by-step flow.
          </p>

          <h2>FAQ</h2>
          {faqItems.map((item) => (
            <section key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </section>
          ))}
        </article>

        <RelatedGuides currentHref="/guides/how-to-add-a-place" />
      </div>
    </GuidesShell>
  )
}
