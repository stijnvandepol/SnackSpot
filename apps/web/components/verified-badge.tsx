interface VerifiedBadgeProps {
  className?: string
}

export function VerifiedBadge({ className = 'w-4 h-4' }: VerifiedBadgeProps) {
  return (
    <svg
      className={`inline-block text-[#1d9bf0] flex-shrink-0 ${className}`}
      viewBox="0 0 22 22"
      fill="none"
      aria-label="Verified"
      role="img"
    >
      <circle cx="11" cy="11" r="11" fill="currentColor" />
      <path
        d="M6.5 11.5L9.5 14.5L15.5 8.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
