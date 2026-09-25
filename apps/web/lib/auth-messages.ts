/**
 * Dutch copy for the errors the auth API returns.
 *
 * The API keeps its English messages (they are part of the contract other clients and tests
 * rely on); the auth forms translate the ones a person can act on. Anything unknown gets a
 * friendly generic line rather than leaking an English string into a Dutch form.
 */
const AUTH_ERROR_NL: Array<[RegExp, string]> = [
  [/too many (registration|login) attempts/i, 'Te veel pogingen achter elkaar. Probeer het over een paar minuten opnieuw.'],
  [/email or username already taken/i, 'Dit e-mailadres of deze gebruikersnaam is al in gebruik. Log in, of kies een andere gebruikersnaam.'],
  [/invalid email or password/i, 'E-mailadres of wachtwoord klopt niet.'],
  [/account banned/i, 'Dit account is geblokkeerd. Neem contact op als je denkt dat dit een vergissing is.'],
  [/captcha|security check/i, 'Rond eerst de beveiligingscheck hieronder af.'],
  [/validation/i, 'Controleer de velden hieronder: er klopt nog iets niet.'],
  [/network/i, 'Geen verbinding. Controleer je internet en probeer het opnieuw.'],
]

export function authErrorNl(message: string | null | undefined, fallback: string): string {
  if (!message) return fallback
  const match = AUTH_ERROR_NL.find(([pattern]) => pattern.test(message))
  return match ? match[1] : fallback
}

/** Google SSO error codes (`/auth/login?error=…`) to Dutch copy. */
export function oauthErrorNl(code: string): string {
  if (code === 'google_unavailable') return 'Inloggen met Google is nu niet beschikbaar. Gebruik je e-mailadres en wachtwoord.'
  if (code === 'banned') return 'Dit account is geblokkeerd.'
  return 'Inloggen met Google is niet gelukt. Probeer het opnieuw, of log in met e-mail en wachtwoord.'
}
