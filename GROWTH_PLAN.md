# SnackSpot — audit, groeiplan en roadmap

*September 2026. Geschreven na een end-to-end audit van de codebase, de Search Console-export
van augustus en een lokale run van de volledige app (PostgreSQL 16 + PostGIS, Redis, Next.js).*

---

## 0. Waar we staan, in één alinea

Technisch is SnackSpot verder dan je bij "weinig gebruikers" zou verwachten. Stadspagina's,
gerechtranglijsten per stad, een sitemap met quality gates, deelkaarten, badges, quests,
data-export, 490 unit tests. Het probleem zit vooral ergens anders. **Bijna al het organische
verkeer komt van mensen die "snackspot" al kennen** (70 van de 90 klikken in de GSC-export), place-pagina's
krijgen wel vertoningen maar nul klikken, en op het moment dat iemand iets wil bijdragen —
"Schrijf een review" aantikken zonder account — raakte die persoon de zaak kwijt en belandde
op de homepage. Er werd ook niets gemeten, dus niemand kon dat zien.

Kortom: de basis is goed, de trechter lekt, en je vliegt blind. Dat is de volgorde waarin ik
het heb aangepakt.

---

## 1. De gebruikersreis, stap voor stap

| Stap | Wat er gebeurde | Frictie | Status |
|---|---|---|---|
| Landing (Google → place/stad/home) | Place-titel "Naam — Stad" | Matchte geen enkele "… reviews"-zoekopdracht; 0% CTR | **Opgelost**: titel met cijfer + "reviews & wat je bestelt" |
| Zoeken | `/search`, `/nearby`, stadspagina's | Geen landelijke gerecht-ingang ("frikandel speciaal review") | **Opgelost**: `/gerechten` |
| Zaak bekijken | Goede pagina, "Dit moet je bestellen" | Niets te doen zonder te reviewen; geen manier om fouten te melden | **Opgelost**: Bewaren + "Klopt er iets niet?" |
| Account maken | Engelstalig formulier op een Nederlandse site | Taalbreuk precies op het conversiemoment; wachtwoordregels pas na submit zichtbaar | **Opgelost**: NL, live wachtwoordcheck, h1, `role="alert"` |
| Terug naar waar je was | Altijd naar `/` | **Grootste lek**: context kwijt na login/registratie (ook bij Google) | **Opgelost**: `?next=` met open-redirect-bescherming |
| Review plaatsen | Foto eerst, 3 stappen | Formulier grotendeels Engels | Deels (gate NL), rest op de roadmap |
| Terugkomen | Notificaties, streaks, quests | Geen reden om terug te komen zonder zelf te posten | **Opgelost**: Bewaard-lijst; lifecycle-mail als plan (§6) |
| Cookiebanner | "Accept/Decline", Engelstalig, over de bottom-nav | Vroeg toestemming voor een strikt noodzakelijke cookie; Decline deed niets | **Verwijderd** |

---

## 2. Uitgevoerde wijzigingen en waarom ze ertoe doen

### Conversie
- **Terugkeer na login/registratie** (`lib/next-path.ts`, auth-pagina's, Google OAuth via een
  kortlevend cookie). *Impact*: iedereen die vanaf een zaak wil reviewen of bewaren komt na het
  aanmelden terug op precies die plek. Dit is waarschijnlijk de wijziging met de hoogste
  conversie-impact per regel code. Validatie tegen `//evil.com`, `/\evil.com`, controltekens en
  loops terug naar `/auth` zit erin, met tests.
- **`AuthGate`**: elke login-muur biedt eerst "Gratis account maken", dan "Ik heb al een account".
  Voorheen was het één knop "Log in", terwijl de meeste bezoekers nog geen account hebben.
- **Auth-flow in het Nederlands**, inclusief vertaalde API-fouten (clientside, zodat het API-contract
  gelijk blijft), live wachtwoordregels en een geruststellende regel: *"Gratis, geen advertenties.
  Je kunt je account altijd zelf verwijderen."*

### Retentie
- **Bewaren** (favorieten). Het table bestond sinds migratie 001, maar er was geen API en geen UI.
  Het is de goedkoopste retentielus die er is: iemand die iets bewaart is gebruiker geworden
  zonder dat die al een review hoeft te schrijven.
- **Bewaard-tab** op het profiel (privé, niet op `/u/[username]`).

### SEO
- **`/gerechten` en `/gerechten/[gerecht]`**: landelijke ranglijst per gerecht, achter dezelfde
  quality gate als de gerechtpagina's per stad (≥2 zaken, ≥3 reviews). Doel: "frikandel speciaal
  review", "waar eet je de beste kapsalon". Unieke inhoud per pagina (cijfers, bovenste zaak,
  citaten), `ItemList`-JSON-LD, breadcrumbs, links naar de stadsvarianten. In de sitemap, en gelinkt vanuit
  footer, place-pagina ("Dit moet je bestellen") en de stadsgerechtpagina.
- **Place-titels** gericht op hoe er echt gezocht wordt ("da verdi reviews"): `Naam Stad: 4.3★
  reviews & wat je bestelt`. Metadata en body gebruiken nu dezelfde stadsbron.
- **Fix: JSON-LD-injectie.** `BreadcrumbJsonLd` gebruikte kale `JSON.stringify` met door
  gebruikers ingevoerde gerechtnamen. Een gerecht met `</script>` in de naam kon uit de tag breken.
  Nu overal `safeJsonLd`.

### Meten (nieuw — er was niets)
- **Anonieme funneltellers** (`lib/analytics-*.ts`, `POST /api/v1/events`): dagtotalen per stap in
  Redis. Geen cookie, geen IP, geen user-id, allowlist van events. Daardoor valt het buiten de
  toestemmingsplicht en klopt de privacybelofte nog steeds. Registratie, login, reviews, bewaren en
  meldingen worden **server-side** geteld (adblock-proof).
- **Core Web Vitals uit het veld** (`components/web-vitals.tsx`): LCP/INP/CLS gebucket als
  goed / verbeteren / slecht, met dezelfde drempels die Search Console hanteert.
- **Dashboard** op `/admin/analytics` (alleen ADMIN): stappen, conversie tussen stappen, CWV-%
  goed, per-dagtabel.

### Veiligheid, privacy, moderatie
- **Marketingmail is opt-in** (Telecommunicatiewet 11.7). Voorheen ging een broadcast naar álle
  gebruikers. Nu is er een nieuwe voorkeur `marketing_emails` (standaard uit), een schakelaar in de
  instellingen, filtering in beide verzendroutes en een afmeldregel in elke mail.
  **Gevolg: na deploy ontvangt niemand marketingmail tot mensen zich aanmelden.** Dat is de bedoeling.
- **Locaties melden** (gesloten, verkeerd adres, dubbel, naam). Nieuw report-type `PLACE`, zichtbaar in
  beide moderatie-UI's, met "Gecorrigeerd, afhandelen" in de admin-app. Reports geven nu 404 op
  onbekende targets (was een 500) en dedupliceren open meldingen per persoon.
- **Rate limits op het echte client-IP**: `CF-Connecting-IP` eerst. Achter nginx → cloudflared was
  `X-Real-IP` het adres van de tunnel (één gedeelde emmer voor de hele site), en
  `X-Forwarded-For[0]` kan de client zelf kiezen.
- **Review-aanmaak**: de zaak wordt pas opgezocht of aangemaakt (Nominatim-call) *na* fotovalidatie
  en de rate limit.
- **Afgekeurde foto's** worden niet langer geserveerd: de publieke varianten worden verwijderd.
- **Ban** trekt alle refresh tokens in (effect binnen 15 minuten in plaats van pas bij logout).
- **Google-accounts** kunnen zichzelf verwijderen (bevestigen met gebruikersnaam; er is geen
  wachtwoord). Dat was een AVG art. 17-gat.
- **Skiplink** verplaatst nu echt de focus (WCAG 2.4.1).

### Performance
- **Kaartlijsten** (profiel, zoeken, place, gebruiker) laden de 1024px-variant in plaats van
  2048px/q90. Dat scheelt ruwweg 3–4× bytes per kaart op mobiel.
- **Stedenlijst** gecachet in Redis (5 min) + `React.cache`. Die draaide een volledige
  `places ⋈ reviews GROUP BY` op elke home-, zoek-, nearby- en place-request.
- **Place-pagina**: vijf queries parallel in plaats van na elkaar.
- **Migratie 039**: indexen voor favorieten, FK-cascades (review-purge, accountverwijdering) en
  een expressie-index op `LOWER(TRIM(dish_name))` voor alle gerechtaggregaties.

---

## 3. Buiten de repo — doe dit bij de deploy

1. **Cloudflare Cache Rule voor `/api/v1/photos/*`** (zie `infra/SEO_CRAWL_HEALTH.md` §1). Nog steeds de
   grootste performancewinst: elke foto, ook het LCP-beeld, gaat nu door Node.
2. **Na het afkeuren van een foto** de URL purgen in Cloudflare; de edge houdt anders een kopie.
3. **Poort 8080 binden aan `127.0.0.1`** als alles via de tunnel loopt, zodat niemand
   `CF-Connecting-IP` kan spoofen door de tunnel te omzeilen.
4. **Migratie 039 draaien** (gebeurt automatisch via de `migrate`-service).
5. Search Console: de sitemap opnieuw indienen, zodat `/gerechten` snel wordt ontdekt.

---

## 4. Resterende verbeterpunten (geprioriteerd)

| # | Wat | Waarom | Inspanning |
|---|---|---|---|
| 1 | Review-formulier, reacties en profiel volledig Nederlands | Taalbreuk blijft conversie kosten | M |
| 2 | Place/review-pagina's ISR (`from`-UI naar client) | Nu dynamisch per request | M |
| 3 | Foto-URL met extensie (`/p/…/x.webp`) | Edge-caching zonder aparte rule | M |
| 4 | `next/font` i.p.v. `@fontsource` | Preload + fallback-metrics → minder CLS | S |
| 5 | Turnstile bij registratie + lagere limieten voor accounts < 24 u | Spam/botbescherming reviews | S |
| 6 | Eén review per gebruiker per zaak per dag afdwingen | Nu 5/dag per zaak toegestaan | S |
| 7 | E-mailmeldingen (comment/follow) standaard uit of expliciet als dienstbericht benoemen | Privacytekst zegt "met toestemming" | S |
| 8 | Privacyverklaring in het Nederlands + subverwerkers benoemen (Cloudflare, Resend, Google, OSM) | Transparantie art. 13 | S |
| 9 | Kaart op place-pagina pas laden bij in beeld | ~800 KB maplibre op elke place-view | S |
| 10 | Profielreviews server-side seeden | Crawlbaarheid + CLS op `/u/…` | M |
| 11 | Foutmonitoring (`instrumentation.ts` → Sentry of pino-alert) | 2,95% 5xx in GSC zonder bron | S |
| 12 | Reports voor comments en gebruikers in de UI | Enum bestaat, UI niet | S |
| 13 | `pino-pretty` naar devDependencies, ongebruikte `@snackspot/ui`-dependency weg | Opruimen | XS |
| 14 | Verouderde E2E-specs bijwerken (`home`, `navigation`, `search`: labels "Create new post", "Guides", "Reset" bestaan niet meer) en E2E in CI draaien | Kritieke flows worden nu niet automatisch bewaakt | S |
| 15 | pino-pretty-transport crasht in dev ("the worker has exited") en verbergt dan de echte fout | Debuggen kost onnodig tijd | XS |

---

## 5. Groeistrategie: de eerste 1.000 gebruikers

**Principe: één stad tegelijk, verticaal vullen.** Een reviewplatform zonder reviews is een
lege winkel. Veertig reviews verspreid over het land betekenen niets. Veertig reviews in één stad,
over twaalf zaken en vijf gerechten, leveren een stadspagina en drie gerechtranglijsten op die
écht iets zeggen. Daarmee rankt SnackSpot op "beste frikandel speciaal [stad]".

### Fase 1 — Beachhead (week 1–6): één stad, 150 reviews
- **Kies de stad** waar de meeste bestaande reviews zitten (zie `/snackplekken`). Waarschijnlijk
  de thuisstad van de oprichter: daar ken je de zaken.
- **Seed zonder te liegen.** Geen nepreviews, ook niet "om op gang te komen". Wel:
  - de oprichter en 5–10 vrienden eten echt bij 15–20 zaken en reviewen met foto;
  - zaken aanmaken via de provider (OSM) zodat adres en stad kloppen;
  - per zaak het gerecht invullen, want dáár zit de unieke waarde (gerechtranglijsten).
- **Doel**: 1 stadspagina, ≥ 5 gerechtpagina's per stad, ≥ 3 landelijke gerechtpagina's.

### Fase 2 — Aanbodkant activeren (week 4–10)
- **QR-kaartje bij de kassa**: *"Wat moet je hier bestellen? Kijk wat anderen aten →"* met een link naar
  `/place/…?from=qr`. Snackbarhouders krijgen gratis zichtbaarheid; geef ze een A6-kaartje en
  een sticker "Beoordeeld op SnackSpot". Meet: `place_view|…` en daarna `signup_view`.
- **Eigenaar-ambassadeurs**: 5 zaken die hun eigen pagina delen op Instagram. Nooit betalen voor
  reviews en nooit reviews van eigenaren zelf; dat moet ook in de voorwaarden staan.

### Fase 3 — Vraagkant (week 6–12)
- **TikTok/Reels-format "De beste [gerecht] van [stad]"**: 30 seconden, 3 zaken, de ranglijst van
  SnackSpot als bron, link in bio naar de gerechtpagina. Het format schaalt per stad en gerecht
  en de pagina bestaat al.
- **Lokale communities**: Facebookgroepen ("Je bent een echte [stad]er als…"), Reddit
  r/Netherlands en stadssubs, studentenverenigingen. Deel een ranglijst, geen reclame.
- **Referral light**: nog geen beloningssysteem. Wel de deelknop prominenter na het plaatsen van een
  review (*"Deel je review — je vrienden zien wat ze moeten bestellen"*). Meet `share_clicked`
  per `review_created`.

### Experimenten

| # | Hypothese | Meting | Verwachte impact | Beslisregel |
|---|---|---|---|---|
| E1 | Place-titels met "reviews" verhogen de CTR op place-pagina's | GSC CTR place-URL's, 28 d voor/na | 0% → 2–4% | < 1% na 6 weken → titel herzien |
| E2 | Terugkeer na login verhoogt het aandeel accounts dat binnen 1 dag een review plaatst | `first_review_created / signup_completed` | +30–50% relatief | Baseline eerst 2 weken meten |
| E3 | "Bewaren" is een lagere drempel dan "Review schrijven" | `signup_view|source=save_place` vs. `review_started` | Bewaren levert ≥ 25% van de aanmeldingen | < 10% → knop anders positioneren |
| E4 | QR-kaartjes leveren registraties op | `place_view|direct` bij QR-zaken, `signup_completed` | 5–15 accounts per zaak per maand | < 2 → stoppen |
| E5 | `/gerechten` rankt op "[gerecht] review" | GSC-vertoningen `/gerechten/*` | Eerste vertoningen binnen 4–8 weken | Geen vertoningen na 8 weken → content per pagina verrijken |

---

## 6. Lifecycle-communicatie (voorstel, nog niet gebouwd)

Allemaal **opt-in of dienstbericht**, met afmeldlink, en respectvol in frequentie.

| Moment | Kanaal | Inhoud | Grondslag |
|---|---|---|---|
| Direct na registratie | Mail (bestaat) | Welkom + *"Plaats je eerste review in 1 minuut"* + link naar `/add-review` | Dienstbericht |
| Dag 3, nog geen review | Push (als aan) | *"Iets lekkers gegeten? Laat zien wat je bestelde."* | Toestemming (push) |
| Bewaarde zaak, 14 dagen later | Push/mail | *"Ben je al bij [zaak] geweest? Vertel wat je bestelde."* | Toestemming |
| Iemand reageert/liket | Push/mail (bestaat) | — | Toestemming per categorie |
| Nieuwe gerechtranglijst in je stad | Mail (marketing) | Alleen met `marketing_emails` aan | Toestemming |
| 60 dagen inactief | Mail (marketing) | *"Dit is er nieuw in [stad]"* — max. 1× | Toestemming |

Bouwvolgorde: eerst de review-reminder voor bewaarde zaken (grootste hefboom, bestaande
push-infrastructuur in `lib/push-service.ts` + BullMQ-worker).

---

## 7. Contentstrategie (lokaal en schaalbaar)

- **Stadspagina's** (`/snackplekken/[stad]`) en **gerechtpagina's** (`/gerechten/…`,
  `/snackplekken/[stad]/[gerecht]`) zijn de kern. Ze groeien automatisch mee met reviews en worden pas
  zichtbaar boven de quality gate. Geen dunne, automatisch gegenereerde pagina's.
- **Redactionele gidsen** (per kwartaal, handgeschreven): *"Frikandel speciaal: wat maakt een goede?"*,
  *"De kapsalon-test in Rotterdam"*. Ze linken naar de datagedreven pagina's.
- **Seizoen**: oliebollen (december), friet bij de kermis, BBQ-snacks (zomer). Een gids per seizoen,
  gekoppeld aan de gerechtpagina zodra die bestaat.
- **Vergelijkingen** alleen als de data het draagt: *"Kroket vs. frikandel in [stad]"* pas bij
  ≥ 3 zaken per gerecht.

---

## 8. KPI's

| KPI | Bron | Nu | Doel 90 d |
|---|---|---|---|
| Organische klikken (niet-merk) | GSC, filter zonder "snackspot" | ~0/dag | 10/dag |
| CTR place-pagina's | GSC | 0% | 3% |
| Registratieconversie | `signup_completed / signup_view` | onbekend (nieuw) | ≥ 35% |
| Eerste review na registratie | `first_review_created / signup_completed` | onbekend | ≥ 30% |
| Reviews per actieve gebruiker / maand | DB | — | ≥ 2 |
| Terugkerende gebruikers (30 d) | DB: `refresh_tokens` of reviews/bites per week | — | ≥ 25% |
| Bewaard → review | favorites met latere review van dezelfde user | — | ≥ 15% |
| Core Web Vitals (% goed, p75) | `/admin/analytics` + GSC CWV | onbekend | ≥ 75% op LCP/INP/CLS |
| 5xx-aandeel crawl | GSC crawlstatistieken | 2,95% | < 0,5% |

---

## 9. Roadmap

**30 dagen**
- Deployen + de acties uit §3.
- Twee weken baseline meten op `/admin/analytics`.
- Beachhead-stad kiezen; 60 echte reviews met gerechtnaam.
- Review-formulier en comments volledig Nederlands (punt 1 in §4).
- Foutmonitoring (punt 11).

**60 dagen**
- QR-pilot bij 10 zaken (E4).
- Review-reminder voor bewaarde zaken (§6).
- Turnstile bij registratie + limieten voor nieuwe accounts (punten 5–6).
- ISR voor place/review-pagina's, `next/font`, lazy kaart (punten 2, 4, 9).
- Eerste TikTok/Reels-serie in de beachhead-stad.

**90 dagen**
- Tweede stad, zelfde playbook; evaluatie E1–E5.
- Privacyverklaring NL + subverwerkers (punt 8).
- Eerste seizoensgids.
- Beslissen of een referral-beloning (bijv. badge "Aanbrenger") het waard is, op basis van de
  `share_clicked`-data.
