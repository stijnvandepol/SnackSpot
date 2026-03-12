import type { Metadata } from 'next'
import Link from 'next/link'
import { RelatedGuides } from '@/components/RelatedGuides'

const faqItems = [
  {
    question: 'Can I add SnackSpot to my home screen without installing from an app store?',
    answer:
      'Yes. Open SnackSpot in your browser and use Add to Home Screen to place it as an icon on your phone.',
  },
  {
    question: 'Why do I not see “Add to Home Screen”?',
    answer:
      'Use Chrome on Android or Safari on iPhone, and open SnackSpot directly in the browser instead of an in-app browser.',
  },
  {
    question: 'Does this work on both Android and iOS?',
    answer:
      'Yes. The exact steps differ by platform, but both Android and iPhone support adding SnackSpot to the home screen.',
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
  title: 'Add SnackSpot to your home screen (Android & iPhone)',
  description:
    'Step-by-step guide to add SnackSpot to your mobile home screen on Android and iOS, including fixes for common issues.',
  alternates: {
    canonical: '/guides/add-snackspot-to-home-screen',
  },
}

export default function AddSnackSpotToHomescreenGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <article className="prose prose-slate max-w-none">
        <h1>Add SnackSpot to your home screen (Android &amp; iPhone)</h1>

        <p>
          You can use SnackSpot like an app experience without installing anything from an app store. By adding SnackSpot
          to your home screen, you can open it instantly with one tap.
        </p>
        <p>
          This guide gives you clear step-by-step instructions for Android and iOS, plus quick fixes for the most common
          setup issues.
        </p>

        <h2>Why add SnackSpot to your home screen?</h2>
        <h3>Faster access</h3>
        <p>
          You do not need to open a browser and type the URL every time. SnackSpot appears as an icon next to your other
          apps.
        </p>
        <h3>Cleaner app-like experience</h3>
        <p>
          SnackSpot opens in a focused view with less browser clutter, making it easier to browse places and reviews.
        </p>
        <h3>Better daily flow</h3>
        <p>
          It is ideal if you frequently want to <Link href="/nearby">find hidden gem restaurants near you</Link>,{' '}
          <Link href="/feed">see real food reviews on SnackSpot</Link>, or quickly <Link href="/search">discover restaurants nearby</Link>.
        </p>

        <h2>Android: add SnackSpot to home screen</h2>
        <h3>Method 1: Google Chrome</h3>
        <ol>
          <li>Open Chrome on your Android phone.</li>
          <li>Go to SnackSpot (for example the feed or nearby page).</li>
          <li>Tap the three-dot menu in the top-right corner.</li>
          <li>Select <strong>Add to Home screen</strong>.</li>
          <li>Optionally rename it to “SnackSpot”.</li>
          <li>Tap <strong>Add</strong> and confirm placement.</li>
        </ol>

        <h3>Method 2: Samsung Internet</h3>
        <ol>
          <li>Open Samsung Internet.</li>
          <li>Go to SnackSpot.</li>
          <li>Open the browser menu.</li>
          <li>Choose <strong>Add page to</strong> and then <strong>Home screen</strong>.</li>
          <li>Confirm to place the icon.</li>
        </ol>

        <h3>After adding on Android</h3>
        <p>
          Locate the SnackSpot icon on your home screen and tap it to launch. You can move it into your dock or any folder.
        </p>

        <h2>iPhone (iOS): add SnackSpot to home screen</h2>
        <h3>Important: use Safari</h3>
        <p>
          On iPhone, Add to Home Screen works best from Safari. In-app browsers and some third-party browsers may hide this
          option.
        </p>

        <h3>Steps in Safari</h3>
        <ol>
          <li>Open Safari on your iPhone.</li>
          <li>Go to SnackSpot.</li>
          <li>Tap the <strong>Share</strong> button (square with upward arrow).</li>
          <li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
          <li>Confirm the icon name (for example “SnackSpot”).</li>
          <li>Tap <strong>Add</strong>.</li>
        </ol>

        <h3>After adding on iPhone</h3>
        <p>
          SnackSpot now appears on your home screen. You can move it like any other app and place it in your dock if you
          use it often.
        </p>

        <h2>Troubleshooting</h2>
        <h3>“Add to Home Screen” is missing</h3>
        <ul>
          <li>Use Safari on iPhone and Chrome on Android.</li>
          <li>Open SnackSpot directly in the browser, not inside Instagram/Facebook/WhatsApp browsers.</li>
          <li>Refresh the page and try again.</li>
        </ul>

        <h3>Icon was added but opens incorrectly</h3>
        <ul>
          <li>Remove the home screen icon.</li>
          <li>Open SnackSpot again in the correct browser.</li>
          <li>Add it again using the steps above.</li>
        </ul>

        <h3>The app view looks outdated</h3>
        <ul>
          <li>Close and reopen SnackSpot from the icon.</li>
          <li>Refresh inside SnackSpot.</li>
          <li>If needed, clear browser cache and add again.</li>
        </ul>

        <h2>Quick usage tips</h2>
        <h3>Pin SnackSpot in your dock</h3>
        <p>
          This gives one-tap access all day.
        </p>
        <h3>Use a simple decision flow</h3>
        <p>
          Start in <Link href="/search">search</Link>, validate options in <Link href="/nearby">nearby</Link>, and check
          context in the <Link href="/feed">live review feed</Link>.
        </p>
        <h3>Create an account for faster return visits</h3>
        <p>
          With an account you can move faster through your own discovery flow. Sign up via{' '}
          <Link href="/auth/register">SnackSpot registration</Link>.
        </p>

        <h2>Ready to use SnackSpot from your home screen?</h2>
        <p>
          Once added, SnackSpot behaves like a lightweight app shortcut so you can quickly open nearby discovery and review
          context whenever you need a better local food decision.
        </p>

        <h2>FAQ</h2>
        {faqItems.map((item) => (
          <section key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </section>
        ))}

        <section className="mt-8 rounded-2xl border border-snack-border bg-snack-surface p-5">
          <h3 className="m-0">Start now</h3>
          <p className="mt-3">
            Open <Link href="/nearby">find hidden gem restaurants near you</Link>, continue with{' '}
            <Link href="/search">discover restaurants nearby</Link>, and verify your pick in{' '}
            <Link href="/feed">real SnackSpot reviews</Link>. Need an account first?{' '}
            <Link href="/auth/register">Create one here</Link>.
          </p>
        </section>
      </article>

      <RelatedGuides currentHref="/guides/add-snackspot-to-home-screen" />
    </div>
  )
}
