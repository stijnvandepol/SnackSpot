import { Resend } from 'resend'
import { env } from './env'
import { escapeHtml } from './html'

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
  const dish = dishName ? ` of ${safeSubjectPart(dishName)}` : ''
  const subject = `${safeSubjectPart(actorUsername)} liked your review${dish}`
  await sendEmailWithFallback({
    to,
    subject,
    html: renderBrandedEmail({
      previewText: subject,
      eyebrow: 'New like',
      title: 'Someone liked your review',
      intro: html(
        `Hi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(recipientUsername)}</strong>, <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(actorUsername)}</strong> liked your review${escapeHtml(dish)} on SnackSpot.`,
      ),
      action: { label: 'View review', href: reviewUrl },
      calloutTitle: 'Keep sharing',
      calloutBody: html('Every review you write helps others discover great food spots. Thank you for contributing!'),
    }),
    fallbackHtml: renderFallbackEmail({
      title: 'Someone liked your review',
      body: `Hi ${escapeHtml(recipientUsername)}, ${escapeHtml(actorUsername)} liked your review${escapeHtml(dish)} on SnackSpot.`,
      linkLabel: 'View review',
      linkHref: reviewUrl,
      footer: 'You can manage notification preferences in your profile settings.',
    }),
    text: `${safeSubjectPart(actorUsername)} liked your review${dish} on SnackSpot.\n\nView it here: ${reviewUrl}\n\nManage notifications in your profile settings.`,
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
  const dish = dishName ? ` of ${safeSubjectPart(dishName)}` : ''
  const subject = `${safeSubjectPart(actorUsername)} commented on your review${dish}`
  await sendEmailWithFallback({
    to,
    subject,
    html: renderBrandedEmail({
      previewText: subject,
      eyebrow: 'New comment',
      title: 'Someone commented on your review',
      intro: html(
        `Hi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(recipientUsername)}</strong>, <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(actorUsername)}</strong> left a comment on your review${escapeHtml(dish)} on SnackSpot.`,
      ),
      action: { label: 'View comment', href: reviewUrl },
      calloutTitle: 'Join the conversation',
      calloutBody: html('Reply to keep the discussion going and help others find great food!'),
    }),
    fallbackHtml: renderFallbackEmail({
      title: 'New comment on your review',
      body: `Hi ${escapeHtml(recipientUsername)}, ${escapeHtml(actorUsername)} commented on your review${escapeHtml(dish)} on SnackSpot.`,
      linkLabel: 'View comment',
      linkHref: reviewUrl,
      footer: 'You can manage notification preferences in your profile settings.',
    }),
    text: `${safeSubjectPart(actorUsername)} commented on your review${dish} on SnackSpot.\n\nView it here: ${reviewUrl}\n\nManage notifications in your profile settings.`,
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
  const place = placeName ? ` at ${safeSubjectPart(placeName)}` : ''
  const subject = `${safeSubjectPart(actorUsername)} mentioned you in a review${place}`
  await sendEmailWithFallback({
    to,
    subject,
    html: renderBrandedEmail({
      previewText: subject,
      eyebrow: 'You were mentioned',
      title: 'Someone mentioned you',
      intro: html(
        `Hi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(recipientUsername)}</strong>, <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(actorUsername)}</strong> mentioned you in a review${escapeHtml(place)} on SnackSpot.`,
      ),
      action: { label: 'View review', href: reviewUrl },
      calloutTitle: 'Your community',
      calloutBody: html('SnackSpot members are talking about you. Click the button above to see what they said.'),
    }),
    fallbackHtml: renderFallbackEmail({
      title: 'You were mentioned',
      body: `Hi ${escapeHtml(recipientUsername)}, ${escapeHtml(actorUsername)} mentioned you in a review${escapeHtml(place)} on SnackSpot.`,
      linkLabel: 'View review',
      linkHref: reviewUrl,
      footer: 'You can manage notification preferences in your profile settings.',
    }),
    text: `${safeSubjectPart(actorUsername)} mentioned you in a review${place} on SnackSpot.\n\nView it here: ${reviewUrl}\n\nManage notifications in your profile settings.`,
    category: 'notification-mention',
  })
}

export async function sendNotificationBadgeEmail(
  to: string,
  recipientUsername: string,
  badgeName: string,
  profileUrl: string,
): Promise<void> {
  const subject = `You unlocked "${safeSubjectPart(badgeName)}" on SnackSpot!`
  await sendEmailWithFallback({
    to,
    subject,
    html: renderBrandedEmail({
      previewText: subject,
      eyebrow: 'Achievement unlocked',
      title: 'New badge earned!',
      intro: html(
        `Hi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(recipientUsername)}</strong>, you just unlocked the <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(badgeName)}</strong> badge on SnackSpot. Keep exploring and reviewing food spots to earn more!`,
      ),
      action: { label: 'View your profile', href: profileUrl },
      calloutTitle: 'Keep going',
      calloutBody: html('Every review you write and place you discover brings you closer to new achievements.'),
    }),
    fallbackHtml: renderFallbackEmail({
      title: 'Achievement unlocked!',
      body: `Hi ${escapeHtml(recipientUsername)}, you just unlocked the "${escapeHtml(badgeName)}" badge on SnackSpot!`,
      linkLabel: 'View your profile',
      linkHref: profileUrl,
      footer: 'You can manage notification preferences in your profile settings.',
    }),
    text: `You unlocked "${safeSubjectPart(badgeName)}" on SnackSpot!\n\nView your profile: ${profileUrl}\n\nManage notifications in your profile settings.`,
    category: 'notification-badge',
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
    }),
    fallbackHtml: renderFallbackEmail({
      title,
      body: escapeHtml(introText),
      ...(action ? { linkLabel: action.label, linkHref: action.href } : {}),
      footer: escapeHtml(calloutText),
    }),
    text: `${introText}\n\n${calloutTitle}\n${calloutText}${action ? `\n\n${action.href}` : ''}`,
    category: 'marketing',
  })
}

// ─── Welcome email ────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
  await sendEmailWithFallback({
    to,
    subject: 'Welcome to SnackSpot!',
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

// ─── Email templates ──────────────────────────────────────────────────────────

function welcomeEmailHtml(username: string): string {
  return renderBrandedEmail({
    previewText: 'Welcome to SnackSpot!',
    eyebrow: 'Welcome',
    title: 'Welcome to SnackSpot!',
    intro: html(
      `Hi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(username)}</strong>, thanks for joining SnackSpot! We're excited to have you. Start exploring hidden food spots near you right now.`,
    ),
    calloutTitle: 'What is SnackSpot?',
    calloutBody: html(
      'SnackSpot helps you discover and share hidden food gems in your city. Browse spots shared by the community, leave reviews, and add your own favorites.',
    ),
  })
}

function welcomeEmailText(username: string): string {
  return `Welcome to SnackSpot!

Hi ${username}, thanks for joining SnackSpot!

We're excited to have you. Start exploring hidden food spots near you right now.

If you did not create a SnackSpot account, you can safely ignore this email.`
}

function welcomeEmailFallbackHtml(username: string): string {
  return renderFallbackEmail({
    title: 'Welcome to SnackSpot!',
    body: `Hi <strong style="color:${EMAIL_TEXT};">${escapeHtml(username)}</strong>, thanks for joining SnackSpot! We're excited to have you on board.`,
    footer: 'If you did not create a SnackSpot account, you can safely ignore this email.',
  })
}

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
