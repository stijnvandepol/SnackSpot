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
