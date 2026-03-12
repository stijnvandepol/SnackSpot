import type { Metadata } from 'next'
import Link from 'next/link'
import { RelatedGuides } from '@/components/RelatedGuides'
import { GuidesShell } from '@/components/guides-shell'

const faqItems = [
  {
    question: 'Is account deletion permanent?',
    answer:
      'Yes. Once your account is deleted, your profile, reviews, and all associated data are permanently removed and cannot be recovered.',
  },
  {
    question: 'What happens to my reviews after I delete my account?',
    answer: 'Your reviews and all content posted under your account will be removed along with your account.',
  },
  {
    question: 'Can I reuse my username after deleting my account?',
    answer: 'After deletion the username is released. Another user may register with the same username in the future.',
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
  title: 'How to delete your SnackSpot account',
  description:
    'Permanently delete your SnackSpot account and all associated data from your profile settings.',
  alternates: {
    canonical: '/guides/how-to-delete-your-account',
  },
}

export default function HowToDeleteYourAccountPage() {
  return (
    <GuidesShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <article className="guide-content guide-article prose prose-slate">
          <h1>How to delete your SnackSpot account</h1>

          <p>
            You can permanently delete your SnackSpot account from your profile settings. Deleting your account removes
            your profile, all reviews you have posted, and all other data associated with your account.
            This action cannot be undone.
          </p>

          <h2>Before you delete</h2>
          <p>
            Make sure you want to permanently remove your account. There is no way to recover your data after deletion.
            If you just want a break, you can simply stop using the app — your account will remain untouched.
          </p>

          <h2>Steps to delete your account</h2>
          <ol>
            <li>
              Make sure you are <Link href="/auth/login">logged in</Link>.
            </li>
            <li>
              Go to your <Link href="/profile">profile settings</Link>.
            </li>
            <li>Scroll to the bottom of the settings page.</li>
            <li>Click <strong>Delete account</strong>.</li>
            <li>Confirm the deletion when prompted.</li>
            <li>Your account and all associated data will be permanently removed.</li>
          </ol>

          <h2>FAQ</h2>
          {faqItems.map((item) => (
            <section key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </section>
          ))}
        </article>

        <RelatedGuides currentHref="/guides/how-to-delete-your-account" />
      </div>
    </GuidesShell>
  )
}
