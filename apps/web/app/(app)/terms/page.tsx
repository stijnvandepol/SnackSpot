import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The rules for using SnackSpot: eligibility, your account, what you may post, moderation, and the legal basics.',
  alternates: { canonical: '/terms' },
}

// Plain-language terms for a user-generated-content platform. Covers eligibility
// (GDPR Art. 8 age threshold), the licence users grant on their content, the
// DSA notice-and-action duty (kept in sync with the Report/Moderation flow), and
// Dutch governing law. Company-identifying details live on /imprint.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-snack-text">Terms of Service</h1>
        <p className="text-sm text-snack-muted mt-1">Last updated: 18 June 2026</p>
      </div>

      <div className="card p-5 space-y-3">
        <p className="text-sm text-snack-muted">
          These terms are an agreement between you and SnackSpot (&ldquo;SnackSpot&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;). They explain the rules for using the app and website.
          By creating an account or using SnackSpot you agree to these terms. If you do not agree,
          please do not use the service. Who operates SnackSpot is set out on our{' '}
          <Link href="/imprint" className="text-snack-primary hover:underline">company information</Link> page.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">1. Who can use SnackSpot</h2>
        <p className="text-sm text-snack-muted">
          You must be at least <strong className="text-snack-text">16 years old</strong> to create an
          account. By registering you confirm that you meet this age requirement. SnackSpot is a free
          service; we do not ask for payment details.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">2. Your account</h2>
        <ul className="list-disc pl-5 text-sm text-snack-muted space-y-1">
          <li>You are responsible for keeping your login credentials secure and for activity on your account.</li>
          <li>Provide accurate information and one account per person; do not impersonate others.</li>
          <li>You can edit your profile, export your data, or delete your account at any time in{' '}
            <Link href="/profile?tab=settings" className="text-snack-primary hover:underline">Settings</Link>.</li>
        </ul>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">3. What you may post</h2>
        <p className="text-sm text-snack-muted">
          SnackSpot lets you share reviews, ratings, photos and comments. You agree not to post content that:
        </p>
        <ul className="list-disc pl-5 text-sm text-snack-muted space-y-1">
          <li>is unlawful, defamatory, harassing, hateful, or threatening;</li>
          <li>is false or misleading, or that you were paid to post without disclosing it;</li>
          <li>infringes someone else&apos;s intellectual property, privacy, or other rights;</li>
          <li>contains other people who are identifiable without a reasonable basis to share their image;</li>
          <li>contains spam, malware, or attempts to break or abuse the service.</li>
        </ul>
        <p className="text-sm text-snack-muted">
          Reviews must reflect your genuine experience. Honest criticism is welcome; deliberately false
          or damaging statements about a business are not.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">4. Your content stays yours</h2>
        <p className="text-sm text-snack-muted">
          You keep ownership of everything you post. To run the service, you grant SnackSpot a
          non-exclusive, worldwide, royalty-free licence to host, store, reproduce and display your
          content within the app and its features (for example showing your review on a place page or
          in the social feed). This licence ends when you delete the content or your account, except
          for copies we are legally required to keep or that others have already lawfully reshared.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">5. Moderation, reporting and takedowns</h2>
        <p className="text-sm text-snack-muted">
          Anyone can report a review or photo using the report option on that item. We review reports
          and may hide, remove, or restrict content, and warn, suspend or ban accounts, when content
          breaks these terms or the law. Where we remove your content or restrict your account, we aim
          to tell you the reason. If you believe a decision was wrong, you can contact us to object.
          Rights holders may report content that infringes their rights at the contact address on our{' '}
          <Link href="/imprint" className="text-snack-primary hover:underline">company information</Link> page.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">6. Place data and third parties</h2>
        <p className="text-sm text-snack-muted">
          Venue names, addresses and map data come in part from{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-snack-primary hover:underline">OpenStreetMap</a>,
          &copy; OpenStreetMap contributors, available under the Open Database Licence (ODbL). SnackSpot
          relies on a small number of external service providers to operate; these are listed on our{' '}
          <Link href="/subprocessors" className="text-snack-primary hover:underline">sub-processors</Link> page,
          and how we handle your personal data is described in our{' '}
          <Link href="/privacy" className="text-snack-primary hover:underline">Privacy Policy</Link>.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">7. Availability and disclaimers</h2>
        <p className="text-sm text-snack-muted">
          SnackSpot is provided &ldquo;as is&rdquo;. We work to keep it running but cannot guarantee it
          will be uninterrupted or error-free, and reviews reflect the opinions of users, not SnackSpot.
          To the extent permitted by law, we are not liable for indirect or consequential damages. Nothing
          in these terms limits liability that cannot be excluded under Dutch law, including your statutory
          consumer rights.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">8. Ending use</h2>
        <p className="text-sm text-snack-muted">
          You may stop using SnackSpot and delete your account at any time. We may suspend or end your
          access if you seriously or repeatedly break these terms, or where we are required to by law.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">9. Changes</h2>
        <p className="text-sm text-snack-muted">
          We may update these terms as the service evolves. If we make material changes we will update
          the date above and, where appropriate, notify you in the app. Continued use after a change
          means you accept the updated terms.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">10. Governing law &amp; contact</h2>
        <p className="text-sm text-snack-muted">
          These terms are governed by the laws of the Netherlands, and disputes fall under the
          jurisdiction of the competent Dutch courts, without affecting any mandatory protections of the
          country where you live. Questions? Contact us at{' '}
          <a href="mailto:contact@snackspot.online" className="text-snack-primary hover:underline">contact@snackspot.online</a>.
        </p>
      </div>
    </div>
  )
}
