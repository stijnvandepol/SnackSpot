'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { parseMentions } from '@/lib/mentions'
import { cn } from '@/lib/utils'

interface MentionTextProps {
  text: string
  as?: 'p' | 'div' | 'span'
  className?: string
  mentionClassName?: string
}

const mentionExistsCache = new Map<string, boolean>()

export function MentionText({
  text,
  as = 'p',
  className,
  mentionClassName,
}: MentionTextProps) {
  const Component = as
  const segments = useMemo(() => parseMentions(text), [text])
  const mentionedUsernames = useMemo(
    () => [
      ...new Set(
        segments
          .filter((segment): segment is { type: 'mention'; value: string; username: string } => segment.type === 'mention')
          .map((segment) => segment.username.toLowerCase()),
      ),
    ],
    [segments],
  )

  const [existingMentions, setExistingMentions] = useState<Set<string>>(
    () => new Set(mentionedUsernames.filter((username) => mentionExistsCache.get(username) === true)),
  )

  useEffect(() => {
    setExistingMentions(new Set(mentionedUsernames.filter((username) => mentionExistsCache.get(username) === true)))

    const unknownUsernames = mentionedUsernames.filter((username) => !mentionExistsCache.has(username))
    if (unknownUsernames.length === 0) return

    const controller = new AbortController()

    void fetch(`/api/v1/users/exists?usernames=${encodeURIComponent(unknownUsernames.join(','))}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return
        const json = await res.json().catch(() => ({ data: { existing: [] as string[] } }))
        const existing = new Set<string>(
          Array.isArray(json?.data?.existing)
            ? json.data.existing.map((username: string) => username.toLowerCase())
            : [],
        )

        for (const username of unknownUsernames) {
          mentionExistsCache.set(username, existing.has(username))
        }

        setExistingMentions(new Set(mentionedUsernames.filter((username) => mentionExistsCache.get(username) === true)))
      })
      .catch(() => {
        // Keep unknown mentions as plain text if lookup fails.
      })

    return () => controller.abort()
  }, [mentionedUsernames])

  return (
    <Component className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`}>{segment.value}</span>
        }

        const exists = existingMentions.has(segment.username.toLowerCase())
        if (!exists) {
          return <span key={`mention-${segment.username}-${index}`}>{segment.value}</span>
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
