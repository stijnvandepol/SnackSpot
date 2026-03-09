import { describe, expect, it } from 'vitest'
import { parseMentions } from '@/lib/mentions'

describe('parseMentions', () => {
  it('extracts mentions from plain text', () => {
    expect(parseMentions('Met @alice bij @bob gegeten.')).toEqual([
      { type: 'text', value: 'Met ' },
      { type: 'mention', value: '@alice', username: 'alice' },
      { type: 'text', value: ' bij ' },
      { type: 'mention', value: '@bob', username: 'bob' },
      { type: 'text', value: ' gegeten.' },
    ])
  })

  it('does not treat email addresses as mentions', () => {
    expect(parseMentions('Mail me op test@example.com of praat met @alice.')).toEqual([
      { type: 'text', value: 'Mail me op test@example.com of praat met ' },
      { type: 'mention', value: '@alice', username: 'alice' },
      { type: 'text', value: '.' },
    ])
  })
})
