/**
 * HTML escaping utility.
 *
 * Any user-controlled value that ends up inside an HTML context (email
 * templates, rendered markup) MUST be passed through escapeHtml first to
 * prevent XSS.  Use the html() tagged template in email.ts for developer-
 * controlled markup that is already safe.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Serialises a JSON-LD object for use in a <script> tag via dangerouslySetInnerHTML.
 *
 * JSON.stringify does NOT escape </script>, so a user-supplied value like
 * `</script><script>alert(1)` would break out of the script tag and inject
 * arbitrary JavaScript. This function escapes the three characters that can
 * end or escape a script tag: <, >, and &.
 *
 * @see https://owasp.org/www-community/attacks/xss/
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}
