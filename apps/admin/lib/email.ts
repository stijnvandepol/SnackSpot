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

  const actionBlock = action
    ? `<div style="text-align:center;margin:24px 0">
        <a href="${escapeHtml(action.href)}" style="background:#F97316;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${escapeHtml(action.label)}</a>
      </div>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:580px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB">
    <div style="background:#F97316;padding:28px 32px">
      <span style="color:#fff;font-size:22px;font-weight:700">🍕 SnackSpot</span>
    </div>
    <div style="padding:32px">
      <p style="color:#F97316;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px">${escapeHtml(eyebrow)}</p>
      <h1 style="color:#0F172A;font-size:24px;font-weight:700;margin:0 0 20px;line-height:1.3">${escapeHtml(title)}</h1>
      <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 24px">${introHtml}</p>
      ${actionBlock}
      <div style="background:#F6F7F9;border-radius:12px;padding:20px 24px;margin-top:24px">
        <p style="color:#0F172A;font-weight:600;font-size:14px;margin:0 0 8px">${escapeHtml(calloutTitle)}</p>
        <p style="color:#64748B;font-size:14px;margin:0;line-height:1.6">${calloutHtml}</p>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #F1F5F9;text-align:center">
      <p style="color:#94A3B8;font-size:12px;margin:0">You received this because you have a SnackSpot account.</p>
    </div>
  </div>
</body>
</html>`

  const text = `${introText}\n\n${calloutTitle}\n${calloutText}${action ? `\n\n${action.href}` : ''}`

  await sendEmail({ to, subject: safeSubject, html, text })
}
