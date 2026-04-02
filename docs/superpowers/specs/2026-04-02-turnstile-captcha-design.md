# Design: Cloudflare Turnstile CAPTCHA na mislukte inlogpogingen

**Datum:** 2026-04-02  
**Status:** Goedgekeurd

## Overzicht

Na 3 mislukte inlogpogingen (per IP of per e-mailadres) wordt een Cloudflare Turnstile CAPTCHA vereist. De drempel wordt bewaakt via twee Redis-tellers. Een proactief status-endpoint laat de frontend de widget al tonen vóórdat de gebruiker opnieuw probeert in te loggen.

---

## 1. Mislukte pogingen bijhouden (Redis)

Twee eenvoudige Redis-tellers (INCR + EXPIRE, geen sliding-window):

| Sleutel | Drempel | TTL |
|---|---|---|
| `login:fail:ip:{ip}` | 3 | 15 minuten |
| `login:fail:email:{email}` | 3 | 15 minuten |

- Bij elke **mislukte** inlogpoging (verkeerd wachtwoord of gebruiker niet gevonden): beide tellers ophogen
- Bij een **geslaagde** inlog: beide tellers verwijderen (DEL)
- De bestaande IP-rate-limiter (10/15 min) en account-rate-limiter (5/10 min) blijven ongewijzigd

---

## 2. Nieuw endpoint: `GET /api/v1/auth/captcha-required`

```
GET /api/v1/auth/captcha-required?email=test@example.com
→ 200 { "data": { "captchaRequired": true } }
```

- Geen auth vereist
- Controleert de IP-teller altijd; de e-mailteller alleen als `email` meegegeven is
- Retourneert `captchaRequired: true` zodra óf IP óf e-mailadres ≥ 3 mislukte pogingen heeft
- Retourneert nooit welke teller de trigger was
- Rate-limited: 60 requests/minuut per IP (voorkomt gebruik als oracle)

---

## 3. Wijzigingen in `POST /api/v1/auth/login`

Volgorde van checks in de route:

1. Same-origin check (bestaand)
2. IP rate-limit check (bestaand, 10/15 min)
3. Account rate-limit check (bestaand, 5/10 min)
4. Body parsen
5. **Nieuw: CAPTCHA-check**
   - Haal beide tellers op uit Redis
   - Als óf IP óf e-mailadres ≥ 3: CAPTCHA is vereist
   - Geen `captchaToken` in body → `400 { captchaRequired: true }`
   - Wel token → verifieer via Cloudflare:
     ```
     POST https://challenges.cloudflare.com/turnstile/v0/siteverify
     { secret, response: token, remoteip: ip }
     ```
   - Token ongeldig of `timeout-or-duplicate` → `400 { captchaRequired: true }`
6. Wachtwoord verifiëren (bestaand)
7. **Nieuw: bij mislukking** → beide tellers ophogen (INCR + EXPIRE)
8. **Nieuw: bij succes** → beide tellers verwijderen (DEL), refresh token aanmaken (bestaand)

Elke Turnstile-token is eenmalig — een replay geeft `timeout-or-duplicate` terug.

---

## 4. Frontend (`apps/web/app/auth/login/page.tsx`)

### CAPTCHA-status ophalen
- Bij **pagina-mount**: `GET /api/v1/auth/captcha-required` (zonder e-mail, alleen IP-check)
- Bij **onBlur op het e-mailveld**: `GET /api/v1/auth/captcha-required?email=...`
- State: `captchaRequired: boolean`, `captchaToken: string | null`

### Turnstile-widget
- Package: `@marsidev/react-turnstile`
- Toont alleen als `captchaRequired === true`
- Geplaatst tussen wachtwoordveld en submit-knop
- `onSuccess(token)` → slaat token op in state
- `onExpire()` → wist token uit state
- Submit-knop is `disabled` als `captchaRequired && !captchaToken`

### Login submit
- Als `captchaToken` aanwezig: meesturen in request body als `captchaToken`
- Als server `captchaRequired: true` teruggeeft (token verlopen/ongeldig): widget resetten via `ref.current?.reset()` en wachten op nieuwe token

### `auth-provider.tsx` — `login()`
- Signature uitbreiden: `login(email, password, captchaToken?: string)`
- Token meesturen in de POST body als aanwezig

---

## 5. Nieuwe bestanden

### `apps/web/lib/turnstile.ts`
```ts
// verifyTurnstileToken(token: string, ip: string): Promise<boolean>
// POST https://challenges.cloudflare.com/turnstile/v0/siteverify
// Retourneert false bij timeout-or-duplicate, invalid-input-response, of network error
```

### `apps/web/app/api/v1/auth/captcha-required/route.ts`
- GET handler
- Leest IP + optionele `email` query param
- Raadpleegt beide Redis-tellers
- Rate-limit: 60/min per IP

### `packages/shared/src/index.ts` — `LoginSchema`
Het bestaande `LoginSchema` krijgt een optioneel veld:
```ts
captchaToken: z.string().optional()
```
Dit zorgt dat `parseBody` het token doorgeeft aan de login-handler.

### `apps/web/lib/rate-limit.ts` — nieuwe helpers
```ts
incrementLoginFailures(ip: string, email: string): Promise<void>
resetLoginFailures(ip: string, email: string): Promise<void>
getLoginFailureCount(ip: string, email: string): Promise<{ ip: number; email: number }>
```

---

## 6. Omgevingsvariabelen

| Variabele | Scope | Beschrijving |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Publiek (frontend) | Site key van Cloudflare dashboard |
| `TURNSTILE_SECRET_KEY` | Privé (server) | Secret key voor siteverify API |

Beide toegevoegd aan `apps/web/lib/env.ts` en `.env.example`.

---

## 7. Cloudflare Turnstile configuratie

- Maak een widget aan op het Cloudflare dashboard voor het domein `snackspot.online`
- Widget-type: **Managed** (Cloudflare bepaalt zelf of een challenge nodig is — werkt onzichtbaar voor normale gebruikers)
- Action name: `login` (voor analytics in het Cloudflare dashboard)

---

## Buiten scope

- CAPTCHA op registratie of wachtwoord-reset
- Persistente blokkering (na CAPTCHA-drempel volgt altijd CAPTCHA, geen permanente ban)
- Admin-UI om tellers te resetten
