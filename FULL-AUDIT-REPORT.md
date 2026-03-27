# SEO Audit Report: snackspot.online

**Datum:** 2026-03-27
**Bedrijfstype:** Community food discovery platform (Publisher/Platform)
**Framework:** Next.js 15 (App Router, SSR + CSR hybride)
**Hosting:** Docker + Nginx + Cloudflare Tunnel

---

## Overall SEO Health Score: 58 / 100

| Categorie | Gewicht | Score | Gewogen |
|-----------|---------|-------|---------|
| Technical SEO | 22% | 82/100 | 18.0 |
| Content Quality | 23% | 40/100 | 9.2 |
| On-Page SEO | 20% | 65/100 | 13.0 |
| Schema / Structured Data | 10% | 52/100 | 5.2 |
| Performance (CWV) | 10% | 70/100 | 7.0 |
| AI Search Readiness (GEO) | 10% | 38/100 | 3.8 |
| Images | 5% | 60/100 | 3.0 |
| **Totaal** | **100%** | | **59.2 ~ 58** |

---

## Executive Summary

### Top 5 Kritieke Issues

1. **Homepage (`/`) is een lege redirect** -- De root URL doet een 308 redirect naar `/feed`, waardoor de meest autoritaire URL van de site geen content heeft
2. **`/feed` is volledig client-side rendered** -- Crawlers zien een lege shell; de belangrijkste content-pagina is onzichtbaar voor zoekmachines bij eerste crawl
3. **Extreem dunne content op kernpagina's** -- Homepage heeft 20 woorden, Search 52, Nearby 43 woorden aan main content
4. **Geen llms.txt** -- AI-zoekmachines missen context over de site
5. **Ontbrekende Organization schema** -- Geen merkidentiteit in Google's Knowledge Graph

### Top 5 Quick Wins

1. Voeg `llms.txt` toe aan de public folder (30 min)
2. Voeg Organization schema toe aan root layout (1 uur)
3. Voeg BreadcrumbList schema toe aan alle pagina's (1-2 uur)
4. Voeg homepage `/` toe aan de sitemap (5 min)
5. Maak OG titles pagina-specifiek i.p.v. generiek "SnackSpot" (30 min)

---

## 1. Technical SEO (82/100)

### Crawlability -- PASS
- **robots.txt**: Goed geconfigureerd via Next.js Metadata API. Blokkeert correct: `/api/`, `/auth/`, `/admin/`, `/profile`, `/add-review`, `/review/*/edit`
- **Sitemap**: Dynamisch gegenereerd, bevat statische pagina's + dynamische places/reviews/users

### Indexability -- PASS met waarschuwingen
- Canonical tags correct ingesteld op alle pagina's
- Meta robots staan indexering toe met uitgebreide snippet/image preview directives
- 404 pagina's zetten correct `noindex`

### Security -- UITSTEKEND
| Header | Status |
|--------|--------|
| HTTPS (Cloudflare) | PASS |
| HSTS (2 jaar + preload) | PASS |
| Content-Security-Policy | PASS |
| X-Content-Type-Options: nosniff | PASS |
| X-Frame-Options: DENY | PASS |
| Referrer-Policy: strict-origin-when-cross-origin | PASS |
| Permissions-Policy | PASS |

### Issues

| # | Issue | Prioriteit |
|---|-------|-----------|
| 1 | **Homepage 308 redirect naar /feed** -- Root URL heeft geen content, verspilt de meest autoritaire URL | High |
| 2 | **`/feed` is volledig CSR** -- Crawlers zien een lege shell bij eerste bezoek | High |
| 3 | **Root canonical conflict** -- Root layout canonical wijst naar redirectende URL | High |
| 4 | **`/search` en `/nearby` zijn CSR-only** maar staan in de sitemap als indexeerbare pagina's | Medium |
| 5 | Geen AI crawler regels in robots.txt (GPTBot, CCBot, ClaudeBot) | Medium |
| 6 | UUID-gebaseerde URLs missen keyword-signalen | Low |
| 7 | IndexNow protocol niet geimplementeerd | Low |

---

## 2. Content Quality (40/100)

### Content Diepte per Pagina

| Pagina | Woorden | Beoordeling |
|--------|---------|-------------|
| `/feed` (homepage) | 20 | KRITIEK -- Extreem dun (content laadt via JS) |
| `/product` | 451 | OK -- Voldoende voor een landing page |
| `/guides` | 185 | WAARSCHUWING -- Borderline dun |
| `/search` | 52 | KRITIEK -- Dun (content laadt via JS) |
| `/nearby` | 43 | KRITIEK -- Dun (content laadt via JS) |

### E-E-A-T Assessment

| Signaal | Status | Score |
|---------|--------|-------|
| **Experience** | Reviews zijn user-generated met foto's -- authentieke ervaring | Medium |
| **Expertise** | Geen auteursinformatie, geen credentials, geen bio's | Laag |
| **Authoritativeness** | Geen Organization schema, geen Wikipedia entiteit, geen backlink profiel zichtbaar | Laag |
| **Trustworthiness** | Goede security headers, HTTPS, privacybeleid onbekend | Medium |

### Heading Structuur

| Pagina | H1 | H2s | Beoordeling |
|--------|----|----|-------------|
| `/feed` | "Latest Food Reviews" | Geen | WAARSCHUWING -- Geen subsecties |
| `/product` | "Find your next hidden food gem in minutes." | 4x (volle zinnen) | WAARSCHUWING -- H2s zijn zinnen, niet kopjes |
| `/guides` | "SnackSpot Guides" | 6x (goed) | PASS |
| `/search` | "Explore" | 1x "Latest review spots" | OK |
| `/nearby` | "Nearby Food Spots" | Geen | WAARSCHUWING |

### AI Citation Readiness -- LAAG
- Geen informationele content die brede food-discovery vragen beantwoordt
- Korte paragrafen (15-35 woorden), ver onder de optimale 134-167 woorden voor AI citatie
- Geen statistieken, databronnen of onderbouwde claims
- Guide pagina's zijn app-specifiek, niet breed citeerbaar

---

## 3. On-Page SEO (65/100)

### Title Tags

| Pagina | Title | Lengte | Beoordeling |
|--------|-------|--------|-------------|
| `/feed` | "SnackSpot -- Discover local food spots \| SnackSpot" | 49 chars | WAARSCHUWING -- Merknaam herhaald |
| `/product` | "SnackSpot -- Discover Hidden Food Gems Near You \| SnackSpot" | 58 chars | WAARSCHUWING -- Merknaam herhaald |
| `/guides` | "SnackSpot Guides -- How to use SnackSpot \| SnackSpot" | 51 chars | WAARSCHUWING -- Merknaam 3x |
| `/search` | "Explore Food Spots \| SnackSpot" | 30 chars | PASS |
| `/nearby` | "Nearby Food Spots \| SnackSpot" | 29 chars | PASS |

### Meta Descriptions

| Pagina | Lengte | Beoordeling |
|--------|--------|-------------|
| `/feed` | 129 chars | PASS -- Goede lengte, beschrijvend |
| `/product` | 143 chars | PASS |
| `/guides` | 119 chars | PASS |
| `/search` | 135 chars | PASS |
| `/nearby` | 141 chars | PASS |

### OG Tags Issues

| # | Issue | Prioriteit |
|---|-------|-----------|
| 1 | **OG titles zijn generiek "SnackSpot"** op /feed, /guides, /search, /nearby -- moeten pagina-specifiek zijn | High |
| 2 | OG descriptions zijn identiek op alle pagina's -- moeten pagina-specifiek zijn | Medium |
| 3 | Duplicate `mobile-web-app-capable` meta tag op alle pagina's | Low |

---

## 4. Schema / Structured Data (52/100)

### Huidige Implementatie

| Schema Type | Locatie | Status |
|-------------|---------|--------|
| WebSite + SearchAction | Root layout | PASS -- Goed voor Sitelinks Search Box |
| WebApplication | Root layout | PASS met waarschuwingen |
| LocalBusiness + AggregateRating | `/place/[id]` | PASS |
| Review + Rating | `/review/[id]` | PASS |
| FAQPage | Guide pagina's | PASS |

### Ontbrekende Schema

| Schema Type | Prioriteit | Impact |
|-------------|-----------|--------|
| **Organization** | KRITIEK | Essentieel voor Knowledge Graph en AI citaties |
| **BreadcrumbList** | KRITIEK | Quick win voor rich results op alle pagina's |
| ItemList op /guides | High | Carousel-weergave in zoekresultaten |
| Article/BlogPosting op guides | Medium | Rich results voor individuele guides |
| Restaurant referenties in content | Medium | Entiteitsassociaties versterken |

### Validatie Issues
- `offers.price` is string `"0"` i.p.v. nummer `0`
- Ontbrekende `offers.availability` op WebApplication Offer

---

## 5. Performance / Core Web Vitals (70/100)

*PageSpeed Insights API quota bereikt -- analyse gebaseerd op broncode*

### Resource Overzicht
| Resource | Aantal | Opmerking |
|----------|--------|-----------|
| JS chunks | 13 | Veel, maar async geladen |
| CSS bestanden | 1 | Goed -- enkele gebundelde CSS |
| Font preloads | 4 | WAARSCHUWING -- 4 fonts is veel |
| HTML grootte | 23.3 KB | Acceptabel |

### Positieve Signalen
- Fonts gebruiken `display: 'swap'` (geen render-blocking)
- Next.js Image optimalisatie met AVIF en WebP
- Eerste review-afbeelding in feed gebruikt `priority` voor LCP
- Nginx cachet afbeeldingen 365 dagen met `immutable`
- Review afbeeldingen gebruiken `aspect-square` (voorkomt CLS)
- Sticky mobile nav heeft vaste hoogte (voorkomt CLS)

### Aandachtspunten
| # | Issue | Prioriteit |
|---|-------|-----------|
| 1 | 4 font preloads is veel -- overweeg reduceren tot 2 essientiele varianten | Medium |
| 2 | 13 JS chunks op homepage -- bundel-optimalisatie controleren | Medium |
| 3 | `/feed` en `/search` zijn zware CSR pagina's -- INP risico door state management | Medium |
| 4 | Geen hero image op `/product` -- LCP is tekst, geen visueel element | Low |

---

## 6. AI Search Readiness / GEO (38/100)

### AI Crawler Toegang

| Crawler | Status | Opmerking |
|---------|--------|-----------|
| GPTBot (OpenAI) | Toegestaan (impliciet via wildcard) | Geen expliciete regel |
| ClaudeBot (Anthropic) | Toegestaan (impliciet) | Geen expliciete regel |
| PerplexityBot | Toegestaan (impliciet) | Geen expliciete regel |
| CCBot (training) | Toegestaan (onbedoeld?) | Overweeg te blokkeren |

### Platform Zichtbaarheid (geschat)

| Platform | Score | Reden |
|----------|-------|-------|
| Google AI Overviews | 25/100 | Te weinig informationele content |
| ChatGPT | 20/100 | Geen llms.txt, beperkte citeerbare passages |
| Perplexity | 20/100 | Ontbreken autoriteitssignalen |
| Bing Copilot | 30/100 | Structured data helpt, maar te weinig content |

### Kritieke Ontbrekende Elementen
1. **Geen llms.txt** -- AI-zoekmachines missen context
2. **Geen expliciete AI crawler regels** -- Geen controle over content gebruik
3. **Geen citeerbare informationele content** -- Site heeft geen antwoorden op brede food-discovery vragen
4. **Geen externe merkpresentie** -- Geen YouTube, geen Wikipedia, beperkte social signals

---

## 7. Images (60/100)

### Positief
- AVIF en WebP formaten geconfigureerd via Next.js Image
- Alt attributen aanwezig op review foto's
- Afbeeldingen worden gecachet (365 dagen, immutable)

### Issues
| # | Issue | Prioriteit |
|---|-------|-----------|
| 1 | Alt teksten zijn generiek (`review.dishName ?? 'Review photo'`) | Medium |
| 2 | Afbeeldingen op MinIO origin -- crawlers volgen mogelijk niet | Medium |
| 3 | Geen OG image variatie per pagina (zelfde OG image overal) | Low |

---

## 8. Sitemap (72/100)

### Positief
- Dynamisch gegenereerd via Next.js
- Bevat statische + dynamische pagina's (places, reviews, users)
- Goede filtering: alleen places met gepubliceerde reviews, geen gebande users
- Referenced in robots.txt

### Issues
| # | Issue | Prioriteit |
|---|-------|-----------|
| 1 | **Homepage `/` ontbreekt** in sitemap | KRITIEK |
| 2 | `changeFrequency` en `priority` tags (genegeerd door Google) | Info |
| 3 | Statische pagina's delen een hardcoded `lastmod` datum | Low |

---

## Prioritized Action Plan

### KRITIEK (Direct oplossen)

| # | Actie | Impact | Inspanning |
|---|-------|--------|------------|
| 1 | **Converteer `/feed` naar SSR met hydration** -- Fetch initiiele feed server-side, wrap interactieve features in `'use client'` child | Hoogste impact -- maakt kernpagina zichtbaar voor crawlers | 4-8 uur |
| 2 | **Los homepage redirect op** -- Serveer content op `/` of maak `/product` de root page | Benut de meest autoritaire URL | 2-4 uur |
| 3 | **Voeg Organization schema toe** aan root layout | Merkidentiteit in Knowledge Graph | 1 uur |
| 4 | **Voeg `/` toe aan sitemap** als eerste entry | Sitemap coverage | 5 min |

### HIGH (Binnen 1 week)

| # | Actie | Impact | Inspanning |
|---|-------|--------|------------|
| 5 | **Maak OG titles pagina-specifiek** -- Gebruik dezelfde titel als de `<title>` tag | Social sharing & CTR | 30 min |
| 6 | **Voeg llms.txt toe** met site beschrijving, content categorieen, en citatie-instructies | AI zoekzichtbaarheid | 1-2 uur |
| 7 | **Voeg BreadcrumbList schema toe** op alle pagina's | Rich results | 1-2 uur |
| 8 | **Voeg expliciete AI crawler regels toe** aan robots.txt -- Allow GPTBot/ClaudeBot/PerplexityBot, block CCBot | Content controle | 30 min |
| 9 | **Fix title tags** -- Verwijder dubbele merknamen | On-page SEO | 30 min |

### MEDIUM (Binnen 1 maand)

| # | Actie | Impact | Inspanning |
|---|-------|--------|------------|
| 10 | SSR fallback content voor `/search` en `/nearby` | Indexeerbare content op deze pagina's | 4-6 uur |
| 11 | Maak H2s op `/product` korte kopjes i.p.v. volle zinnen | Content structuur | 1 uur |
| 12 | Voeg ItemList schema toe op `/guides` | Carousel rich results | 1 uur |
| 13 | Creeer informationele blog content (city guides, food tips) | AI citability + organic traffic | Doorlopend |
| 14 | Reduceer font preloads van 4 naar 2 | Performance | 1 uur |
| 15 | Voeg Article schema toe aan individuele guide pagina's | Rich results | 2 uur |

### LOW (Backlog)

| # | Actie | Impact | Inspanning |
|---|-------|--------|------------|
| 16 | Implementeer IndexNow protocol voor snellere indexering | Bing/Yandex indexering | 2-4 uur |
| 17 | Overweeg human-readable URL slugs voor places | Keyword signalen in URLs | Groot |
| 18 | Bouw externe merkpresentie (YouTube, LinkedIn, Reddit) | Autoriteitssignalen | Doorlopend |
| 19 | Fix duplicate `mobile-web-app-capable` meta tag | Clean HTML | 5 min |
| 20 | Verwijder `changeFrequency` en `priority` uit sitemap | Cleaner sitemap | 15 min |

---

*Rapport gegenereerd door SEO Audit Tool -- 2026-03-27*
