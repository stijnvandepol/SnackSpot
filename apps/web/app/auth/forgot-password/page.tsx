import Link from 'next/link'

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-snack-surface to-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h2 className="text-2xl font-heading font-bold text-snack-text mb-2">Forgot password?</h2>
        <p className="text-sm text-snack-muted mb-8">
          Password reset is not implemented in this demo. Please contact an admin.
        </p>
        <Link href="/auth/login" className="btn-primary inline-block">Back to login</Link>
      </div>
    </div>
  )
}
