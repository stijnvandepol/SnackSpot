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
<body style="margin:0;padding:0;background:#F6F7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <!-- Header -->
          <tr>
            <td style="background:#0F172A;padding:28px 40px;">
              <p style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                <span style="color:#F97316;">Snack</span><span style="color:#DC2626;">Spot</span>
              </p>
            </td>
          </tr>
          <!-- Orange accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#F97316,#DC2626);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F172A;">Reset your password</p>
              <p style="margin:0 0 28px;font-size:15px;color:#64748B;line-height:1.6;">
                We received a request to reset the password for your SnackSpot account.
                Click the button below to choose a new password. This link is valid for <strong style="color:#0F172A;">15 minutes</strong>.
              </p>
              <a href="${resetUrl}"
                 style="display:inline-block;padding:13px 28px;background:#F97316;color:#ffffff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.1px;">
                Reset password
              </a>
              <p style="margin:28px 0 0;font-size:13px;color:#94A3B8;line-height:1.6;">
                If you did not request a password reset, you can safely ignore this email —
                your password will not be changed.
              </p>
              <hr style="border:none;border-top:1px solid #F1F5F9;margin:28px 0;" />
              <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.6;">
                If the button above does not work, copy and paste this link into your browser:<br />
                <span style="word-break:break-all;color:#64748B;">${resetUrl}</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;padding:20px 40px;border-top:1px solid #F1F5F9;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">
                &copy; ${new Date().getFullYear()} SnackSpot &mdash; Discover the best hidden food spots near you.
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
<body style="margin:0;padding:0;background:#F6F7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <!-- Header -->
          <tr>
            <td style="background:#0F172A;padding:28px 40px;">
              <p style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                <span style="color:#F97316;">Snack</span><span style="color:#DC2626;">Spot</span>
              </p>
            </td>
          </tr>
          <!-- Orange accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#F97316,#DC2626);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F172A;">Password changed</p>
              <p style="margin:0 0 20px;font-size:15px;color:#64748B;line-height:1.6;">
                Hi <strong style="color:#0F172A;">${escapeHtml(username)}</strong>, the password for your SnackSpot account has been successfully changed.
                All active sessions have been signed out.
              </p>
              <p style="margin:0;font-size:14px;color:#64748B;line-height:1.6;">
                If you did not make this change, please contact us immediately by replying to this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;padding:20px 40px;border-top:1px solid #F1F5F9;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">
                &copy; ${new Date().getFullYear()} SnackSpot &mdash; Discover the best hidden food spots near you.
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
