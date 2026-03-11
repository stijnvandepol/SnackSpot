import { Resend } from 'resend'
import { env } from './env'

const resend = new Resend(env.RESEND_API_KEY)

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
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;border:1px solid #e5e5e5;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;">Reset your password</p>
              <p style="margin:0 0 24px;font-size:15px;color:#555;">
                We received a request to reset the password for your SnackSpot account.
                Click the button below to choose a new password. This link is valid for <strong>15 minutes</strong>.
              </p>
              <a href="${resetUrl}"
                 style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;">
                Reset password
              </a>
              <p style="margin:24px 0 0;font-size:13px;color:#888;">
                If you did not request a password reset, you can safely ignore this email.
                Your password will not be changed.
              </p>
              <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#aaa;">
                If the button above does not work, copy and paste the following link into your browser:<br />
                <span style="word-break:break-all;color:#555;">${resetUrl}</span>
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

function passwordResetText(resetUrl: string): string {
  return `Reset your SnackSpot password

We received a request to reset the password for your SnackSpot account.

Click the link below to choose a new password. This link is valid for 15 minutes:

${resetUrl}

If you did not request a password reset, you can safely ignore this email.
Your password will not be changed.`
}

function passwordChangedHtml(username: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password changed</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;border:1px solid #e5e5e5;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;">Password changed</p>
              <p style="margin:0 0 24px;font-size:15px;color:#555;">
                Hi ${escapeHtml(username)}, the password for your SnackSpot account has been successfully changed.
                All active sessions have been signed out.
              </p>
              <p style="margin:0;font-size:14px;color:#555;">
                If you did not make this change, please contact us immediately by replying to this email.
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
