import Link from 'next/link'
import { parseMentions } from '@/lib/mentions'
import { cn } from '@/lib/utils'

interface MentionTextProps {
  text: string
  as?: 'p' | 'div' | 'span'
  className?: string
  mentionClassName?: string
}

export function MentionText({
  text,
  as = 'p',
  className,
  mentionClassName,
}: MentionTextProps) {
  const Component = as
  const segments = parseMentions(text)

  return (
    <Component className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`}>{segment.value}</span>
        }

        return (
          <Link
            key={`mention-${segment.username}-${index}`}
            href={`/u/${encodeURIComponent(segment.username)}`}
            className={cn(
              'font-semibold text-snack-primary underline-offset-2 transition hover:underline focus-visible:underline',
              mentionClassName,
            )}
          >
            {segment.value}
          </Link>
        )
      })}
    </Component>
  )
}
