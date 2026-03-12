import type { Metadata } from 'next'
import Link from 'next/link'
import { RelatedGuides } from '@/components/RelatedGuides'
import { GuidesShell } from '@/components/guides-shell'

const faqItems = [
  {
    question: 'I did not receive the reset email. What should I do?',
    answer:
      'Check your spam or junk folder. If the email is not there after a few minutes, try submitting the form again with the same address.',
  },
  {
    question: 'How long is the reset link valid?',
    answer: 'The reset link expires after a short time. If it has expired, request a new one from the forgot-password page.',
  },
  {
    question: 'I no longer have access to my email address.',
    answer:
      'If you cannot access the email address on your account, you will not be able to reset your password through the standard flow. Contact support for further help.',
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
  title: 'How to change your SnackSpot password',
  description:
    'Reset or update your SnackSpot password using the forgot-password flow. Step-by-step instructions and common fixes.',
  alternates: {
    canonical: '/guides/how-to-change-your-password',
  },
}

export default function HowToChangeYourPasswordPage() {
  return (
    <GuidesShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <article className="guide-content guide-article prose prose-slate">
          <h1>How to change your SnackSpot password</h1>

          <p>
            If you have forgotten your password or want to set a new one, you can do so through the password reset flow.
            SnackSpot will send a reset link to the email address on your account.
          </p>

          <h2>Reset your password</h2>
          <ol>
            <li>
              Go to the <Link href="/auth/forgot-password">forgot password page</Link>.
            </li>
            <li>Enter the email address you used when creating your account.</li>
            <li>Click <strong>Send reset link</strong>.</li>
            <li>Check your inbox for an email from SnackSpot.</li>
            <li>Click the link in the email.</li>
            <li>Enter your new password and confirm it.</li>
            <li>Click <strong>Reset password</strong>. You can now log in with the new password.</li>
          </ol>

          <h2>After resetting</h2>
          <p>
            Once your password is changed, go to the <Link href="/auth/login">login page</Link> and sign in with
            your email and new password.
          </p>

          <h2>FAQ</h2>
          {faqItems.map((item) => (
            <section key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </section>
          ))}
        </article>

        <RelatedGuides currentHref="/guides/how-to-change-your-password" />
      </div>
    </GuidesShell>
  )
}
