import { env } from './env'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

/** Send a single email via the Resend HTTP API. */
async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', opts.to)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend API error ${res.status}: ${body}`)
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function stripCrLf(value: string): string {
  return value.replace(/[\r\n]/g, ' ').trim()
}

// ─── Branded email template (matches web app styling) ────────────────────────

const EMAIL_BACKGROUND = '#F6F7F9'
const EMAIL_SURFACE = '#FFFFFF'
const EMAIL_MUTED_SURFACE = '#F6F7F9'
const EMAIL_PRIMARY = '#F97316'
const EMAIL_ACCENT = '#DC2626'
const EMAIL_TEXT = '#0F172A'
const EMAIL_MUTED = '#64748B'
const EMAIL_BORDER = '#E5E7EB'
const EMAIL_SOFT_BORDER = '#F1F5F9'

function renderWordmark(): string {
  return `<span style="color:${EMAIL_PRIMARY};">Snack</span><span style="color:${EMAIL_ACCENT};">Spot</span>`
}

function renderBrandedEmail({
  previewText,
  eyebrow,
  title,
  intro,
  action,
  calloutTitle,
  calloutBody,
}: {
  previewText: string
  eyebrow: string
  title: string
  intro: string
  action?: { label: string; href: string }
  calloutTitle: string
  calloutBody: string
}): string {
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
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;background:${EMAIL_MUTED_SURFACE};border:1px solid ${EMAIL_SOFT_BORDER};border-radius:12px;">
                      <tr>
                        <td style="padding:18px 18px 16px;">
                          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_PRIMARY};">${escapeHtml(calloutTitle)}</p>
                          <p style="margin:0;font-size:14px;line-height:1.7;color:${EMAIL_TEXT};">${calloutBody}</p>
                        </td>
                      </tr>
                    </table>
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
  const safeSubject = stripCrLf(subject)
  const introHtml = escapeHtml(introText).replace(/\n/g, '<br />')
  const calloutHtml = escapeHtml(calloutText).replace(/\n/g, '<br />')

  const html = renderBrandedEmail({
    previewText: safeSubject,
    eyebrow,
    title,
    intro: introHtml,
    action,
    calloutTitle,
    calloutBody: calloutHtml,
  })

  const text = `${introText}\n\n${calloutTitle}\n${calloutText}${action ? `\n\n${action.href}` : ''}`

  await sendEmail({ to, subject: safeSubject, html, text })
}
