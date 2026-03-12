import { describe, expect, it } from 'vitest'
import { escapeHtml } from '@/lib/html'

describe('escapeHtml', () => {
  // ─── Core XSS vectors ──────────────────────────────────────────────────────

  it('escapes < to prevent tag injection', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes > to prevent tag closing', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b')
  })

  it('escapes & first so subsequent replacements are not double-escaped', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    // If & were escaped last, '&lt;' would become '&amp;lt;'
    expect(escapeHtml('<b>text</b>')).toBe('&lt;b&gt;text&lt;/b&gt;')
  })

  it('escapes " to prevent attribute breakout', () => {
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
  })

  it("escapes ' to prevent attribute breakout in single-quoted attributes", () => {
    expect(escapeHtml("it's here")).toBe('it&#039;s here')
  })

  // ─── Common attack payloads ────────────────────────────────────────────────

  it('neutralises a basic XSS script tag', () => {
    const input = '<script>alert("xss")</script>'
    const output = escapeHtml(input)
    expect(output).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(output).not.toContain('<script>')
  })

  it('neutralises an onerror attribute injection', () => {
    const input = '<img src=x onerror=alert(1)>'
    const output = escapeHtml(input)
    expect(output).not.toContain('<img')
    expect(output).toContain('&lt;img')
  })

  it('neutralises a javascript: URL payload', () => {
    const input = '<a href="javascript:alert(1)">click</a>'
    const output = escapeHtml(input)
    expect(output).not.toContain('<a ')
    expect(output).toContain('&lt;a ')
  })

  it('neutralises HTML entity injection attempt', () => {
    // Attacker tries to inject &amp; hoping it renders as & in the final page
    const input = '&amp;lt;script&amp;gt;'
    expect(escapeHtml(input)).toBe('&amp;amp;lt;script&amp;amp;gt;')
  })

  // ─── User data in email templates ─────────────────────────────────────────

  it('handles a username with angle brackets safely', () => {
    const username = 'evil<script>user'
    expect(escapeHtml(username)).toBe('evil&lt;script&gt;user')
  })

  it('handles a username with ampersand safely', () => {
    const username = 'John & Jane'
    expect(escapeHtml(username)).toBe('John &amp; Jane')
  })

  it('handles a URL with query parameters safely', () => {
    const url = 'https://example.com/reset?token=abc&user=test'
    expect(escapeHtml(url)).toBe('https://example.com/reset?token=abc&amp;user=test')
  })

  // ─── Safe strings pass through unchanged ──────────────────────────────────

  it('returns plain alphanumeric strings unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World')
  })

  it('returns an empty string unchanged', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('does not alter unicode characters', () => {
    expect(escapeHtml('Ångström café naïve')).toBe('Ångström café naïve')
  })

  it('does not alter numbers or punctuation that are not HTML-special', () => {
    expect(escapeHtml('3.14 / 2 = 1.57!')).toBe('3.14 / 2 = 1.57!')
  })
})
