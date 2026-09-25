/**
 * Dutch copy for the errors the auth API returns.
 *
 * The API returns Dutch messages itself; the auth forms map the ones a person can act on to
 * form-specific copy. The English patterns stay as a safety net for client-side errors
 * (e.g. "Network error") and the `captcha_required` code. Anything unknown gets the caller's
 * friendly fallback.
 */
const AUTH_ERROR_NL: Array<[RegExp, string]> = [
  [
    /te veel pogingen|too many (registration|login) attempts/i,
    'Te veel pogingen achter elkaar. Probeer het over een paar minuten opnieuw.',
  ],
  [
    /al in gebruik|email or username already taken/i,
    'Dit e-mailadres of deze gebruikersnaam is al in gebruik. Log in, of kies een andere gebruikersnaam.',
  ],
  [/wachtwoord klopt niet|invalid email or password/i, 'E-mailadres of wachtwoord klopt niet.'],
  [
    /account is geblokkeerd|account banned/i,
    'Dit account is geblokkeerd. Neem contact op als je denkt dat dit een vergissing is.',
  ],
  [/captcha|beveiligingscheck|security check/i, 'Rond eerst de beveiligingscheck hieronder af.'],
  [/controleer de ingevulde gegevens|validation/i, 'Controleer de velden hieronder: er klopt nog iets niet.'],
  [/geen verbinding|network/i, 'Geen verbinding. Controleer je internet en probeer het opnieuw.'],
]

export function authErrorNl(message: string | null | undefined, fallback: string): string {
  if (!message) return fallback
  const match = AUTH_ERROR_NL.find(([pattern]) => pattern.test(message))
  return match ? match[1] : fallback
}

/** Google SSO error codes (`/auth/login?error=…`) to Dutch copy. */
export function oauthErrorNl(code: string): string {
  if (code === 'google_unavailable')
    return 'Inloggen met Google is nu niet beschikbaar. Gebruik je e-mailadres en wachtwoord.'
  if (code === 'banned') return 'Dit account is geblokkeerd.'
  return 'Inloggen met Google is niet gelukt. Probeer het opnieuw, of log in met e-mail en wachtwoord.'
}
