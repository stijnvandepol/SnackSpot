import { Resend } from 'resend'
import { env } from './env'

const resend = new Resend(env.RESEND_API_KEY)

const EMAIL_BACKGROUND = '#FFF7ED'
const EMAIL_SURFACE = '#FFFFFF'
const EMAIL_MUTED_SURFACE = '#F6F7F9'
const EMAIL_PRIMARY = '#F97316'
const EMAIL_ACCENT = '#DC2626'
const EMAIL_TEXT = '#0F172A'
const EMAIL_MUTED = '#64748B'
const EMAIL_BORDER = '#E5E7EB'
const EMAIL_SOFT_BORDER = '#F1F5F9'

// ─── Password reset email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [to],
    subject: 'Reset your SnackSpot password',
    html: passwordResetHtml(resetUrl),
    text: passwordResetText(resetUrl),
    tags: [{ name: 'category', value: 'password-reset' }],
  })

  if (error) {
    // Log without exposing the reset URL or any PII beyond the category
    throw new Error(`Failed to send password reset email: ${error.message}`)
  }
}

// ─── Password changed confirmation email ─────────────────────────────────────

export async function sendPasswordChangedEmail(to: string, username: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [to],
    subject: 'Your SnackSpot password has been changed',
    html: passwordChangedHtml(username),
    text: passwordChangedText(username),
    tags: [{ name: 'category', value: 'password-changed' }],
  })

  if (error) {
    throw new Error(`Failed to send password changed email: ${error.message}`)
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

function passwordResetHtml(resetUrl: string): string {
  return renderBrandedEmail({
    previewText: 'Reset your SnackSpot password',
    eyebrow: 'Account security',
    title: 'Reset your password',
    intro:
      'We received a request to reset the password for your SnackSpot account. Use the button below to choose a new password. This link stays valid for 15 minutes.',
    action: {
      label: 'Reset password',
      href: resetUrl,
    },
    calloutTitle: 'Why you are seeing this',
    calloutBody:
      'Someone entered your email address in the SnackSpot reset flow. If that was you, continue below. If not, no action is needed and your password stays unchanged.',
    secondaryBlockTitle: 'Manual link',
    secondaryBlockBody: `Button not working? Copy and paste this link into your browser:<br /><span style="word-break:break-all;color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(resetUrl)}</span>`,
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

function passwordChangedHtml(username: string): string {
  return renderBrandedEmail({
    previewText: 'Your SnackSpot password was changed',
    eyebrow: 'Account security',
    title: 'Password changed',
    intro: `Hi <strong style="color:${EMAIL_TEXT};font-weight:600;">${escapeHtml(username)}</strong>, the password for your SnackSpot account has been updated successfully. All active sessions have been signed out.`,
    calloutTitle: 'Confirmation',
    calloutBody: 'This change is already complete. You can log in again with your new password on any device.',
    secondaryBlockTitle: 'Did not do this?',
    secondaryBlockBody: 'Reply to this email immediately so the SnackSpot team can help secure your account.',
  })
}

type BrandedEmailOptions = {
  previewText: string
  eyebrow: string
  title: string
  intro: string
  action?: {
    label: string
    href: string
  }
  calloutTitle: string
  calloutBody: string
  secondaryBlockTitle?: string
  secondaryBlockBody?: string
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
            <td style="padding:0 0 20px;">
              <div style="margin:0 0 10px;font-size:30px;font-weight:700;letter-spacing:-0.04em;line-height:1;color:${EMAIL_TEXT};">
                ${renderWordmark()}
              </div>
              <p style="margin:0;font-size:13px;line-height:1.6;color:${EMAIL_MUTED};">
                Discover under-the-radar food spots, share reviews, and keep your account secure.
              </p>
            </td>
          </tr>
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_SURFACE};border:1px solid ${EMAIL_BORDER};border-radius:24px;overflow:hidden;">
                <tr>
                  <td style="padding:0;background:#FFF1E8;border-bottom:1px solid ${EMAIL_SOFT_BORDER};">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:32px 32px 24px;">
                          <span style="display:inline-block;margin:0 0 16px;padding:7px 12px;border-radius:999px;border:1px solid rgba(249,115,22,0.18);background:rgba(255,255,255,0.84);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${EMAIL_PRIMARY};">
                            ${escapeHtml(eyebrow)}
                          </span>
                          <h1 style="margin:0 0 12px;font-size:32px;font-weight:700;line-height:1.15;letter-spacing:-0.04em;color:${EMAIL_TEXT};">
                            ${escapeHtml(title)}
                          </h1>
                          <p style="margin:0;font-size:15px;line-height:1.75;color:${EMAIL_MUTED};">
                            ${intro}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    ${action ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td align="center" bgcolor="${EMAIL_PRIMARY}" style="border-radius:12px;"><a href="${escapeHtml(action.href)}" style="display:inline-block;padding:14px 22px;border-radius:12px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:1;background:${EMAIL_PRIMARY};">${escapeHtml(action.label)}</a></td></tr></table>` : ''}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${secondaryBlockTitle && secondaryBlockBody ? '16px' : '0'};background:${EMAIL_MUTED_SURFACE};border:1px solid ${EMAIL_SOFT_BORDER};border-radius:18px;">
                      <tr>
                        <td style="padding:18px 18px 16px;">
                          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_PRIMARY};">${escapeHtml(calloutTitle)}</p>
                          <p style="margin:0;font-size:14px;line-height:1.7;color:${EMAIL_TEXT};">${calloutBody}</p>
                        </td>
                      </tr>
                    </table>
                    ${secondaryBlockTitle && secondaryBlockBody ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_SURFACE};border:1px solid ${EMAIL_BORDER};border-radius:18px;"><tr><td style="padding:18px 18px 16px;"><p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_MUTED};">${escapeHtml(secondaryBlockTitle)}</p><p style="margin:0;font-size:13px;line-height:1.75;color:${EMAIL_MUTED};">${secondaryBlockBody}</p></td></tr></table>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 4px 0;text-align:center;">
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
