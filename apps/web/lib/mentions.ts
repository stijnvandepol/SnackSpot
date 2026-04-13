export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; username: string }

const USERNAME_MIN = 3
const USERNAME_MAX = 30

// Negative lookbehind (?<![a-zA-Z0-9_]) prevents matching inside email
// addresses (e.g. "user@example.com"). Word boundary \b prevents matching
// when the username runs directly into other word characters.
const mentionRegex = new RegExp(
  `(?<![a-zA-Z0-9_])@([a-zA-Z0-9_]{${USERNAME_MIN},${USERNAME_MAX}})\\b`,
  'g',
)

export function parseMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(mentionRegex)) {
    const matchText = match[0]
    const username = match[1]
    const index = match.index ?? 0

    if (index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, index) })
    }

    segments.push({
      type: 'mention',
      value: matchText,
      username,
    })

    lastIndex = index + matchText.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', value: text })
  }

  return segments
}
