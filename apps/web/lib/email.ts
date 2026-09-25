import { Resend } from 'resend'
import { env } from './env'
import { escapeHtml } from './html'
import { getSiteUrl } from '@/lib/site-url'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY)
  return _resend
}

// ─── Trusted HTML type ────────────────────────────────────────────────────────
//
// Fields in BrandedEmailOptions that are rendered WITHOUT escaping into the HTML
// template are typed as TrustedHtml. A plain `string` is NOT assignable to this
// type — the caller must explicitly wrap the value with the `html()` helper.
//
// RULE: only pass developer-controlled, static markup into `html()`.
//       Never pass user-supplied data (names, addresses, URLs) directly.
//       User data MUST be escaped first: html(`...${escapeHtml(userValue)}...`)
//
declare const __trustedHtmlBrand: unique symbol
type TrustedHtml = string & { readonly [__trustedHtmlBrand]: true }

/** Mark a developer-controlled HTML string as safe for unescaped rendering. */
function html(markup: string): TrustedHtml {
  return markup as TrustedHtml
}

const EMAIL_BACKGROUND = '#F6F7F9'
const EMAIL_SURFACE = '#FFFFFF'
const EMAIL_MUTED_SURFACE = '#F6F7F9'
const EMAIL_PRIMARY = '#F97316'
const EMAIL_ACCENT = '#DC2626'
const EMAIL_TEXT = '#0F172A'
const EMAIL_MUTED = '#64748B'
const EMAIL_BORDER = '#E5E7EB'
const EMAIL_SOFT_BORDER = '#F1F5F9'

// ─── Notification emails ──────────────────────────────────────────────────────

/** Strip CR/LF from user-supplied strings before placing them in email subjects or plain-text bodies. */
function safeSubjectPart(value: string): string {
  return value.replace(/[\r\n]/g, ' ').trim()
}

export async function sendNotificationLikeEmail(
  to: string,
  recipientUsername: string,
  actorUsername: string,
  dishName: string | null,
  reviewUrl: string,
): Promise<void> {
  const dish = dishName ? ` over ${safeSubjectPart(dishName)}` : ''
  const subject = `${safeSubjectPart(actorUsername)} vindt je review${dish} leuk`
  await sendEmailWithFallback({
    to,
    subject,
    html: renderBrandedEmail({
      previewText: subject,
      eyebrow: 'Nieuwe like',
      title: 'Iemand vindt je review leuk',
      intro: html(
        `Hoi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(recipientUsername)}</strong>, <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(actorUsername)}</strong> vindt je review${escapeHtml(dish)} op SnackSpot leuk.`,
      ),
      action: { label: 'Bekijk review', href: reviewUrl },
      calloutTitle: 'Blijf delen',
      calloutBody: html('Met elke review help je anderen een goede snackplek te vinden. Bedankt daarvoor.'),
    }),
    fallbackHtml: renderFallbackEmail({
      title: 'Iemand vindt je review leuk',
      body: `Hoi ${escapeHtml(recipientUsername)}, ${escapeHtml(actorUsername)} vindt je review${escapeHtml(dish)} op SnackSpot leuk.`,
      linkLabel: 'Bekijk review',
      linkHref: reviewUrl,
      footer: 'Je e-mailmeldingen beheer je in je profielinstellingen.',
    }),
    text: `${safeSubjectPart(actorUsername)} vindt je review${dish} op SnackSpot leuk.\n\nBekijk je review: ${reviewUrl}\n\nJe e-mailmeldingen beheer je in je profielinstellingen.`,
    category: 'notification-like',
  })
}

export async function sendNotificationCommentEmail(
  to: string,
  recipientUsername: string,
  actorUsername: string,
  dishName: string | null,
  reviewUrl: string,
): Promise<void> {
  const dish = dishName ? ` over ${safeSubjectPart(dishName)}` : ''
  const subject = `${safeSubjectPart(actorUsername)} reageerde op je review${dish}`
  await sendEmailWithFallback({
    to,
    subject,
    html: renderBrandedEmail({
      previewText: subject,
      eyebrow: 'Nieuwe reactie',
      title: 'Iemand reageerde op je review',
      intro: html(
        `Hoi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(recipientUsername)}</strong>, <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(actorUsername)}</strong> reageerde op je review${escapeHtml(dish)} op SnackSpot.`,
      ),
      action: { label: 'Bekijk reactie', href: reviewUrl },
      calloutTitle: 'Praat mee',
      calloutBody: html('Reageer terug als je iets wilt aanvullen of een vraag wilt beantwoorden.'),
    }),
    fallbackHtml: renderFallbackEmail({
      title: 'Nieuwe reactie op je review',
      body: `Hoi ${escapeHtml(recipientUsername)}, ${escapeHtml(actorUsername)} reageerde op je review${escapeHtml(dish)} op SnackSpot.`,
      linkLabel: 'Bekijk reactie',
      linkHref: reviewUrl,
      footer: 'Je e-mailmeldingen beheer je in je profielinstellingen.',
    }),
    text: `${safeSubjectPart(actorUsername)} reageerde op je review${dish} op SnackSpot.\n\nBekijk de reactie: ${reviewUrl}\n\nJe e-mailmeldingen beheer je in je profielinstellingen.`,
    category: 'notification-comment',
  })
}

export async function sendNotificationMentionEmail(
  to: string,
  recipientUsername: string,
  actorUsername: string,
  placeName: string | null,
  reviewUrl: string,
): Promise<void> {
  const place = placeName ? ` over ${safeSubjectPart(placeName)}` : ''
  const subject = `${safeSubjectPart(actorUsername)} noemde je in een review${place}`
  await sendEmailWithFallback({
    to,
    subject,
    html: renderBrandedEmail({
      previewText: subject,
      eyebrow: 'Vermelding',
      title: 'Iemand noemde je in een review',
      intro: html(
        `Hoi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(recipientUsername)}</strong>, <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(actorUsername)}</strong> noemde je in een review${escapeHtml(place)} op SnackSpot.`,
      ),
      action: { label: 'Bekijk review', href: reviewUrl },
      calloutTitle: 'Wat is er gezegd?',
      calloutBody: html('Via de knop hierboven lees je de review waarin je genoemd wordt.'),
    }),
    fallbackHtml: renderFallbackEmail({
      title: 'Iemand noemde je in een review',
      body: `Hoi ${escapeHtml(recipientUsername)}, ${escapeHtml(actorUsername)} noemde je in een review${escapeHtml(place)} op SnackSpot.`,
      linkLabel: 'Bekijk review',
      linkHref: reviewUrl,
      footer: 'Je e-mailmeldingen beheer je in je profielinstellingen.',
    }),
    text: `${safeSubjectPart(actorUsername)} noemde je in een review${place} op SnackSpot.\n\nBekijk de review: ${reviewUrl}\n\nJe e-mailmeldingen beheer je in je profielinstellingen.`,
    category: 'notification-mention',
  })
}

export async function sendNotificationBadgeEmail(
  to: string,
  recipientUsername: string,
  badgeName: string,
  profileUrl: string,
): Promise<void> {
  const subject = `Je hebt de badge "${safeSubjectPart(badgeName)}" verdiend`
  await sendEmailWithFallback({
    to,
    subject,
    html: renderBrandedEmail({
      previewText: subject,
      eyebrow: 'Nieuwe badge',
      title: 'Je hebt een nieuwe badge',
      intro: html(
        `Hoi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(recipientUsername)}</strong>, je hebt op SnackSpot de badge <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(badgeName)}</strong> verdiend.`,
      ),
      action: { label: 'Bekijk je profiel', href: profileUrl },
      calloutTitle: 'Volgende badge',
      calloutBody: html('Met elke review en elke nieuwe snackplek kom je dichter bij je volgende badge.'),
    }),
    fallbackHtml: renderFallbackEmail({
      title: 'Je hebt een nieuwe badge',
      body: `Hoi ${escapeHtml(recipientUsername)}, je hebt op SnackSpot de badge "${escapeHtml(badgeName)}" verdiend.`,
      linkLabel: 'Bekijk je profiel',
      linkHref: profileUrl,
      footer: 'Je e-mailmeldingen beheer je in je profielinstellingen.',
    }),
    text: `Je hebt op SnackSpot de badge "${safeSubjectPart(badgeName)}" verdiend.\n\nBekijk je profiel: ${profileUrl}\n\nJe e-mailmeldingen beheer je in je profielinstellingen.`,
    category: 'notification-badge',
  })
}

export async function sendNotificationFollowEmail(
  to: string,
  recipientUsername: string,
  actorUsername: string,
  followerProfileUrl: string,
): Promise<void> {
  const subject = `${safeSubjectPart(actorUsername)} volgt je nu op SnackSpot`
  await sendEmailWithFallback({
    to,
    subject,
    html: renderBrandedEmail({
      previewText: subject,
      eyebrow: 'Nieuwe volger',
      title: 'Je hebt een nieuwe volger',
      intro: html(
        `Hoi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(recipientUsername)}</strong>, <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(actorUsername)}</strong> volgt je nu op SnackSpot.`,
      ),
      action: { label: 'Bekijk profiel', href: followerProfileUrl },
      calloutTitle: 'Je volgers',
      calloutBody: html('Je volgers zien je nieuwe reviews in hun feed.'),
    }),
    fallbackHtml: renderFallbackEmail({
      title: 'Je hebt een nieuwe volger',
      body: `Hoi ${escapeHtml(recipientUsername)}, ${escapeHtml(actorUsername)} volgt je nu op SnackSpot.`,
      linkLabel: 'Bekijk profiel',
      linkHref: followerProfileUrl,
      footer: 'Je e-mailmeldingen beheer je in je profielinstellingen.',
    }),
    text: `${safeSubjectPart(actorUsername)} volgt je nu op SnackSpot.\n\nBekijk profiel: ${followerProfileUrl}\n\nJe e-mailmeldingen beheer je in je profielinstellingen.`,
    category: 'notification-follow',
  })
}

// ─── Marketing / broadcast email ─────────────────────────────────────────────

export async function sendMarketingEmail(
  to: string,
  subject: string,
  eyebrow: string,
  title: string,
  introText: string,
  calloutTitle: string,
  calloutText: string,
  action?: { label: string; href: string },
): Promise<void> {
  const safeSubject = safeSubjectPart(subject)
  // Every marketing mail says why it arrived and how to stop it (Telecommunicatiewet 11.7:
  // each message must offer a free, easy way to opt out).
  const settingsUrl = `${getSiteUrl()}/profile?tab=settings`
  const unsubscribeText = `Je krijgt deze mail omdat "Nieuws van SnackSpot" aanstaat in je instellingen. Afmelden: zet het daar uit via ${settingsUrl}`
  await sendEmailWithFallback({
    to,
    subject: safeSubject,
    html: renderBrandedEmail({
      previewText: safeSubject,
      eyebrow,
      title,
      intro: html(escapeHtml(introText).replace(/\n/g, '<br />')),
      action,
      calloutTitle,
      calloutBody: html(escapeHtml(calloutText).replace(/\n/g, '<br />')),
      secondaryBlockTitle: 'Afmelden',
      secondaryBlockBody: html(
        `${escapeHtml('Je krijgt deze mail omdat "Nieuws van SnackSpot" aanstaat in je instellingen.')} <a href="${escapeHtml(settingsUrl)}">Afmelden kan daar met één klik</a>.`,
      ),
    }),
    fallbackHtml: renderFallbackEmail({
      title,
      body: escapeHtml(introText),
      ...(action ? { linkLabel: action.label, linkHref: action.href } : {}),
      footer: `${escapeHtml(calloutText)}<br /><br />${escapeHtml(unsubscribeText)}`,
    }),
    text: `${introText}\n\n${calloutTitle}\n${calloutText}${action ? `\n\n${action.href}` : ''}\n\n${unsubscribeText}`,
    category: 'marketing',
  })
}

// ─── Welcome email ────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
  await sendEmailWithFallback({
    to,
    subject: 'Welkom bij SnackSpot',
    html: welcomeEmailHtml(username),
    fallbackHtml: welcomeEmailFallbackHtml(username),
    text: welcomeEmailText(username),
    category: 'welcome',
  })
}

// ─── Password reset email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmailWithFallback({
    to,
    subject: 'Stel een nieuw SnackSpot-wachtwoord in',
    html: passwordResetHtml(resetUrl),
    fallbackHtml: passwordResetFallbackHtml(resetUrl),
    text: passwordResetText(resetUrl),
    category: 'password-reset',
  })
}

// ─── Password changed confirmation email ─────────────────────────────────────

export async function sendPasswordChangedEmail(to: string, username: string): Promise<void> {
  await sendEmailWithFallback({
    to,
    subject: 'Je SnackSpot-wachtwoord is gewijzigd',
    html: passwordChangedHtml(username),
    fallbackHtml: passwordChangedFallbackHtml(username),
    text: passwordChangedText(username),
    category: 'password-changed',
  })
}

// ─── Email templates ──────────────────────────────────────────────────────────

function welcomeEmailHtml(username: string): string {
  return renderBrandedEmail({
    previewText: 'Welkom bij SnackSpot',
    eyebrow: 'Welkom',
    title: 'Welkom bij SnackSpot',
    intro: html(
      `Hoi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(username)}</strong>, leuk dat je er bent. Zoek een snackbar bij jou in de buurt of schrijf je eerste review.`,
    ),
    calloutTitle: 'Wat is SnackSpot?',
    calloutBody: html(
      'Op SnackSpot lees en schrijf je reviews van snackbars, cafetaria&#39;s en friettenten, per gerecht en met foto&#39;s. Bewaar je favoriete snackplekken en volg andere snackfans.',
    ),
  })
}

function welcomeEmailText(username: string): string {
  return `Welkom bij SnackSpot

Hoi ${username}, leuk dat je er bent.

Zoek een snackbar bij jou in de buurt of schrijf je eerste review.

Heb je geen SnackSpot-account aangemaakt? Dan kun je deze mail negeren.`
}

function welcomeEmailFallbackHtml(username: string): string {
  return renderFallbackEmail({
    title: 'Welkom bij SnackSpot',
    body: `Hoi <strong style="color:${EMAIL_TEXT};">${escapeHtml(username)}</strong>, leuk dat je er bent. Zoek een snackbar bij jou in de buurt of schrijf je eerste review.`,
    footer: 'Heb je geen SnackSpot-account aangemaakt? Dan kun je deze mail negeren.',
  })
}

function passwordResetHtml(resetUrl: string): string {
  return renderBrandedEmail({
    previewText: 'Stel een nieuw SnackSpot-wachtwoord in',
    eyebrow: 'Accountbeveiliging',
    title: 'Nieuw wachtwoord instellen',
    intro: html(
      'We kregen een verzoek om het wachtwoord van je SnackSpot-account opnieuw in te stellen. Kies met de knop hieronder een nieuw wachtwoord. De link is 15 minuten geldig.',
    ),
    action: {
      label: 'Nieuw wachtwoord instellen',
      href: resetUrl,
    },
    calloutTitle: 'Waarom krijg je deze mail?',
    calloutBody: html(
      'Iemand heeft je e-mailadres ingevuld bij &#39;Wachtwoord vergeten&#39; op SnackSpot. Was jij dat niet? Dan hoef je niets te doen. Je wachtwoord blijft hetzelfde.',
    ),
    secondaryBlockTitle: 'Werkt de knop niet?',
    secondaryBlockBody: html(
      `Kopieer deze link en plak hem in je browser:<br /><span style="word-break:break-all;color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(resetUrl)}</span>`,
    ),
  })
}

function passwordResetText(resetUrl: string): string {
  return `Nieuw SnackSpot-wachtwoord instellen

We kregen een verzoek om het wachtwoord van je SnackSpot-account opnieuw in te stellen.

Kies via deze link een nieuw wachtwoord. De link is 15 minuten geldig:

${resetUrl}

Heb je dit niet aangevraagd? Dan kun je deze mail negeren.
Je wachtwoord blijft hetzelfde.`
}

function passwordResetFallbackHtml(resetUrl: string): string {
  return renderFallbackEmail({
    title: 'Nieuw wachtwoord instellen',
    body: 'We kregen een verzoek om je SnackSpot-wachtwoord opnieuw in te stellen. Gebruik de link hieronder binnen 15 minuten.',
    linkLabel: 'Nieuw wachtwoord instellen',
    linkHref: resetUrl,
    footer: 'Heb je dit niet aangevraagd? Dan kun je deze mail negeren.',
  })
}

function passwordChangedHtml(username: string): string {
  return renderBrandedEmail({
    previewText: 'Je SnackSpot-wachtwoord is gewijzigd',
    eyebrow: 'Accountbeveiliging',
    title: 'Wachtwoord gewijzigd',
    intro: html(
      `Hoi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(username)}</strong>, het wachtwoord van je SnackSpot-account is gewijzigd. Je bent op alle apparaten uitgelogd.`,
    ),
    calloutTitle: 'Bevestiging',
    calloutBody: html(
      'De wijziging is doorgevoerd. Log opnieuw in met je nieuwe wachtwoord.',
    ),
    secondaryBlockTitle: 'Was jij dit niet?',
    secondaryBlockBody: html(
      'Beantwoord deze mail dan meteen, zodat we je account kunnen beveiligen.',
    ),
  })
}

type BrandedEmailOptions = {
  previewText: string
  eyebrow: string
  title: string
  /** Rendered unescaped — must be TrustedHtml. Use html() and escapeHtml() for any user data. */
  intro: TrustedHtml
  action?: {
    label: string
    href: string
  }
  calloutTitle: string
  /** Rendered unescaped — must be TrustedHtml. Use html() and escapeHtml() for any user data. */
  calloutBody: TrustedHtml
  secondaryBlockTitle?: string
  /** Rendered unescaped — must be TrustedHtml. Use html() and escapeHtml() for any user data. */
  secondaryBlockBody?: TrustedHtml
}

function renderBrandedEmail({
  previewText,
  eyebrow,
  title,
  intro,
  action,
  calloutTitle,
  calloutBody,
  secondaryBlockTitle,
  secondaryBlockBody,
}: BrandedEmailOptions): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_BACKGROUND};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${EMAIL_TEXT};">
  <div style="display:none;font-size:1px;color:${EMAIL_BACKGROUND};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(previewText)}
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_BACKGROUND};margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
          <tr>
            <td style="padding:0 0 18px;text-align:center;">
              <div style="margin:0 0 8px;font-size:30px;font-weight:700;letter-spacing:-0.04em;line-height:1;color:${EMAIL_TEXT};">
                ${renderWordmark()}
              </div>
              <p style="margin:0;font-size:13px;line-height:1.6;color:${EMAIL_MUTED};">
                Reviews van snackbars en snackplekken, per gerecht.
              </p>
            </td>
          </tr>
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_SURFACE};border:1px solid ${EMAIL_BORDER};border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="height:6px;background:${EMAIL_PRIMARY};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:0;background:${EMAIL_SURFACE};border-bottom:1px solid ${EMAIL_SOFT_BORDER};">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:28px 28px 20px;">
                          <span style="display:inline-block;margin:0 0 14px;padding:7px 12px;border-radius:999px;border:1px solid #FDE6D6;background:#FFF7ED;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${EMAIL_PRIMARY};">
                            ${escapeHtml(eyebrow)}
                          </span>
                          <h1 style="margin:0 0 10px;font-size:28px;font-weight:700;line-height:1.15;letter-spacing:-0.03em;color:${EMAIL_TEXT};">
                            ${escapeHtml(title)}
                          </h1>
                          <p style="margin:0;font-size:15px;line-height:1.7;color:${EMAIL_MUTED};">
                            ${intro}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    ${action ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td align="center" bgcolor="${EMAIL_PRIMARY}" style="border-radius:12px;"><a href="${escapeHtml(action.href)}" style="display:inline-block;padding:14px 22px;border-radius:12px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:1;background:${EMAIL_PRIMARY};">${escapeHtml(action.label)}</a></td></tr></table>` : ''}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${secondaryBlockTitle && secondaryBlockBody ? '14px' : '0'};background:${EMAIL_MUTED_SURFACE};border:1px solid ${EMAIL_SOFT_BORDER};border-radius:12px;">
                      <tr>
                        <td style="padding:18px 18px 16px;">
                          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_PRIMARY};">${escapeHtml(calloutTitle)}</p>
                          <p style="margin:0;font-size:14px;line-height:1.7;color:${EMAIL_TEXT};">${calloutBody}</p>
                        </td>
                      </tr>
                    </table>
                    ${secondaryBlockTitle && secondaryBlockBody ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_SURFACE};border:1px solid ${EMAIL_BORDER};border-radius:12px;"><tr><td style="padding:18px 18px 16px;"><p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_MUTED};">${escapeHtml(secondaryBlockTitle)}</p><p style="margin:0;font-size:13px;line-height:1.75;color:${EMAIL_MUTED};">${secondaryBlockBody}</p></td></tr></table>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 8px 0;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.7;color:#94A3B8;">
                &copy; ${new Date().getFullYear()} SnackSpot. Snackbars bij jou in de buurt, beoordeeld door snackfans.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function renderWordmark(): string {
  return `<span style="color:${EMAIL_PRIMARY};">Snack</span><span style="color:${EMAIL_ACCENT};">Spot</span>`
}

function passwordChangedText(username: string): string {
  return `Wachtwoord gewijzigd

Hoi ${username}, het wachtwoord van je SnackSpot-account is gewijzigd.
Je bent op alle apparaten uitgelogd.

Was jij dit niet? Beantwoord deze mail dan meteen.`
}

function passwordChangedFallbackHtml(username: string): string {
  return renderFallbackEmail({
    title: 'Wachtwoord gewijzigd',
    body: `Hoi <strong style="color:${EMAIL_TEXT};">${escapeHtml(username)}</strong>, je SnackSpot-wachtwoord is gewijzigd en je bent op alle apparaten uitgelogd.`,
    footer: 'Was jij dit niet? Beantwoord deze mail dan meteen.',
  })
}

type FallbackEmailOptions = {
  title: string
  body: string
  linkLabel?: string
  linkHref?: string
  footer: string
}

function renderFallbackEmail({ title, body, linkLabel, linkHref, footer }: FallbackEmailOptions): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px;background:${EMAIL_BACKGROUND};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${EMAIL_TEXT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;">
          <tr>
            <td style="padding:0 0 14px;text-align:center;">
              <div style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.04em;line-height:1;">${renderWordmark()}</div>
            </td>
          </tr>
          <tr>
            <td style="background:${EMAIL_SURFACE};border:1px solid ${EMAIL_BORDER};border-radius:16px;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:5px;background:${EMAIL_PRIMARY};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:24px;">
                    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;line-height:1.2;color:${EMAIL_TEXT};">${escapeHtml(title)}</h1>
                    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${EMAIL_MUTED};">${body}</p>
                    ${linkLabel && linkHref ? `<p style="margin:0 0 18px;"><a href="${escapeHtml(linkHref)}" style="color:${EMAIL_PRIMARY};font-weight:600;text-decoration:none;">${escapeHtml(linkLabel)}</a><br /><span style="font-size:13px;line-height:1.7;color:${EMAIL_MUTED};word-break:break-all;">${escapeHtml(linkHref)}</span></p>` : ''}
                    <p style="margin:0;font-size:14px;line-height:1.7;color:${EMAIL_MUTED};">${footer}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

type SendEmailWithFallbackOptions = {
  to: string
  subject: string
  html: string
  fallbackHtml: string
  text: string
  category: string
}

async function sendEmailWithFallback({ to, subject, html, fallbackHtml, text, category }: SendEmailWithFallbackOptions): Promise<void> {
  const primary = await getResend().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [to],
    subject,
    html,
    text,
    tags: [{ name: 'category', value: category }],
  })

  if (!primary.error) {
    return
  }

  const fallback = await getResend().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [to],
    subject,
    html: fallbackHtml,
    text,
    tags: [
      { name: 'category', value: category },
      { name: 'template', value: 'fallback' },
    ],
  })

  if (!fallback.error) {
    return
  }

  throw new Error(
    `Failed to send ${category} email: primary=${primary.error.message}; fallback=${fallback.error.message}`,
  )
}
