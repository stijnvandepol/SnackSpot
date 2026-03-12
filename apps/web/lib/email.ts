import { Resend } from 'resend'
import { env } from './env'

const resend = new Resend(env.RESEND_API_KEY)

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

function appUrl(path: `/${string}`): string {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}${path}`
}

// ─── Password reset email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmailWithFallback({
    to,
    subject: 'Reset your SnackSpot password',
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
    subject: 'Your SnackSpot password has been changed',
    html: passwordChangedHtml(username),
    fallbackHtml: passwordChangedFallbackHtml(username),
    text: passwordChangedText(username),
    category: 'password-changed',
  })
}

// ─── Welcome email ─────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
  const nearbyUrl = appUrl('/nearby')
  const feedUrl = appUrl('/feed')

  await sendEmailWithFallback({
    to,
    subject: 'Welcome to SnackSpot',
    html: welcomeHtml(username, nearbyUrl, feedUrl),
    fallbackHtml: welcomeFallbackHtml(username, nearbyUrl),
    text: welcomeText(username, nearbyUrl, feedUrl),
    category: 'welcome',
  })
}

// ─── Email templates ──────────────────────────────────────────────────────────

function passwordResetHtml(resetUrl: string): string {
  return renderBrandedEmail({
    previewText: 'Reset your SnackSpot password',
    eyebrow: 'Account security',
    title: 'Reset your password',
    intro: html(
      'We received a request to reset the password for your SnackSpot account. Use the button below to choose a new password. This link stays valid for 15 minutes.',
    ),
    action: {
      label: 'Reset password',
      href: resetUrl,
    },
    calloutTitle: 'Why you are seeing this',
    calloutBody: html(
      'Someone entered your email address in the SnackSpot reset flow. If that was you, continue below. If not, no action is needed and your password stays unchanged.',
    ),
    secondaryBlockTitle: 'Manual link',
    secondaryBlockBody: html(
      `Button not working? Copy and paste this link into your browser:<br /><span style="word-break:break-all;color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(resetUrl)}</span>`,
    ),
  })
}

function passwordResetText(resetUrl: string): string {
  return `Reset your SnackSpot password

We received a request to reset the password for your SnackSpot account.

Click the link below to choose a new password. This link is valid for 15 minutes:

${resetUrl}

If you did not request a password reset, you can safely ignore this email.
Your password will not be changed.`
}

function passwordResetFallbackHtml(resetUrl: string): string {
  return renderFallbackEmail({
    title: 'Reset your password',
    body: 'We received a request to reset your SnackSpot password. Use the link below within 15 minutes.',
    linkLabel: 'Reset password',
    linkHref: resetUrl,
    footer: 'If you did not request this, you can ignore this email.',
  })
}

function passwordChangedHtml(username: string): string {
  return renderBrandedEmail({
    previewText: 'Your SnackSpot password was changed',
    eyebrow: 'Account security',
    title: 'Password changed',
    intro: html(
      `Hi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(username)}</strong>, the password for your SnackSpot account has been updated successfully. All active sessions have been signed out.`,
    ),
    calloutTitle: 'Confirmation',
    calloutBody: html(
      'This change is already complete. You can log in again with your new password on any device.',
    ),
    secondaryBlockTitle: 'Did not do this?',
    secondaryBlockBody: html(
      'Reply to this email immediately so the SnackSpot team can help secure your account.',
    ),
  })
}

function welcomeHtml(username: string, nearbyUrl: string, feedUrl: string): string {
  return renderBrandedEmail({
    previewText: 'Welcome to SnackSpot - discover hidden food spots nearby',
    eyebrow: 'Welcome',
    title: `Welcome to SnackSpot, ${username}!`,
    intro: html(
      `Hi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(username)}</strong>, welcome to SnackSpot. This is where locals share under-the-radar food spots, honest ratings, and real dish photos so you can decide what is actually worth your time.`,
    ),
    action: {
      label: 'Discover spots nearby',
      href: nearbyUrl,
    },
    calloutTitle: 'Ready for your first food mission?',
    calloutBody: html(
      'Are you ready to visit the coolest local spots? Open Nearby, pick a place that looks promising, and start building your personal list of must-try gems.',
    ),
    secondaryBlockTitle: 'Prefer browsing first?',
    secondaryBlockBody: html(
      `Open the discovery feed: <a href="${escapeHtml(feedUrl)}" style="color:${EMAIL_PRIMARY};font-weight:600;text-decoration:none;">${escapeHtml(feedUrl)}</a>`,
    ),
  })
}

function welcomeText(username: string, nearbyUrl: string, feedUrl: string): string {
  return `Welcome to SnackSpot

Hi ${username}, welcome to SnackSpot.

SnackSpot is where locals share under-the-radar food spots, honest ratings, and real dish photos so you can quickly decide what is worth visiting.

Ready to visit the coolest local spots? Start here:
${nearbyUrl}

Prefer browsing first? Open the discovery feed:
${feedUrl}`
}

function welcomeFallbackHtml(username: string, nearbyUrl: string): string {
  return renderFallbackEmail({
    title: `Welcome to SnackSpot, ${username}!`,
    body: `Welcome to SnackSpot. Discover hidden food gems, check real dish photos, and decide where to go next with confidence.`,
    linkLabel: 'Discover spots nearby',
    linkHref: nearbyUrl,
    footer: 'Ready to explore? Start nearby and share your first great find.',
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
<html lang="en">
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
                Find your next hidden food gem in minutes.
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
                &copy; ${new Date().getFullYear()} SnackSpot &mdash; Built for discovering hidden food spots near you.
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
  return `Password changed

Hi ${username}, the password for your SnackSpot account has been successfully changed.
All active sessions have been signed out.

If you did not make this change, please contact us immediately.`
}

function passwordChangedFallbackHtml(username: string): string {
  return renderFallbackEmail({
    title: 'Password changed',
    body: `Hi <strong style="color:${EMAIL_TEXT};">${escapeHtml(username)}</strong>, your SnackSpot password has been changed successfully and active sessions were signed out.`,
    footer: 'If you did not make this change, reply to this email immediately.',
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
<html lang="en">
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
  const primary = await resend.emails.send({
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

  const fallback = await resend.emails.send({
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
