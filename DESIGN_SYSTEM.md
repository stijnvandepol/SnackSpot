# DESIGN_SYSTEM

## 1. Introductie
SnackSpot gebruikt een lichte, mobile-first interface met veel witruimte, afgeronde componenten, subtiele schaduwen en een duidelijke oranje primaire actie-kleur. De publieke webapp gebruikt een consistente token-set (`snack-*`), terwijl het admin-paneel dezelfde basis-kleuren hanteert maar met een donkere sidebar en meer tabelgeoriënteerde schermen.

## 2. Kleuren
### 2.1 Kernkleuren (design tokens)
| Token / variabele | Hex | Gebruik |
|---|---|---|
| `--snack-primary` / `snack.primary` | `#F97316` | Primaire CTA, actieve states, focus-accent |
| `--snack-accent` / `snack.accent` | `#DC2626` | Accent in logo, destructieve accenten |
| `--snack-rating` / `snack.rating` | `#F59E0B` | Sterratings |
| `snack.border` | `#E5E7EB` | Kaartranden / standaard borders |
| `--snack-bg` / `snack.background` | `#FFFFFF` | App-achtergrond |
| `--snack-surface` / `snack.surface` | `#F6F7F9` | Zachte vlakken, skeletons, secondary achtergronden |
| `--snack-text` / `snack.text` | `#0F172A` | Primaire tekst |
| `--snack-muted` / `snack.muted` | `#64748B` | Secundaire tekst |

### 2.2 Overige expliciete hex-kleuren in UI
| Hex | Gebruik |
|---|---|
| `#e7e7e7` | Input/button border |
| `#d8d8d8` | Secondary button focus outline |
| `#9a9a9a` | Input placeholder |
| `#ececec`, `#ededed`, `#eef2f7` | Divider/border/hover nuances |
| `#e0e0e0`, `#dfdfdf` | Inactieve sterren |
| `#0042DB` | Gebruikerslocatie marker (map) |
| `#FF712F` | Place marker + map popup CTA |

### 2.3 Tailwind utility-kleuren die daadwerkelijk gebruikt worden
- `orange`: `50/100/200/500/600/700/800/900`
- `red`: `50/100/200/300/500/600/700/800/900`
- `green`: `50/100/200/600/700/800/900`
- `yellow`: `50/100/200/600/800`
- `blue`: `50/100/200/500/700/900`
- `purple`: `100/600/700/800`
- `gray`: `50/100/200/300/400/500/600/700/800/900`
- `slate`: `300/400/500/800/950`
- `amber`: `50/400`
- `rose`: `600`

### 2.4 Hover, active, focus, states
- `btn-primary`: hover via `filter: brightness(0.95)`.
- `btn-secondary`: hover naar `snack.surface`.
- Navigatie active state: vaak `bg-snack-surface text-snack-primary` (web) of `bg-orange-500 text-white` (admin sidebar).
- Globale focus (`:focus-visible`): `2px` outline in `--snack-primary`, offset `2px`.
- Input focus: border `--snack-primary` + ring `rgba(249,115,22,0.14)`.

### 2.5 Feedback-kleuren (error/success/warning/info)
- Error: vooral `bg-red-50`, `border-red-100/200`, `text-red-600/700`.
- Success: `bg-green-50`, `border-green-200`, `text-green-600/900`.
- Warning: `bg-yellow-50`, `border-yellow-200`, `text-yellow-600/800`.
- Info: `bg-blue-50`, `border-blue-200`, `text-blue-900`.

### 2.6 CSS variabelen
- Web + admin:
  - `--snack-primary`, `--snack-accent`, `--snack-rating`, `--snack-bg`, `--snack-surface`, `--snack-text`, `--snack-muted`
- Alleen web:
  - `--safe-area-inset-bottom`

## 3. Typografie
### 3.1 Fonts
- Webapp:
  - Body/sans: `Inter` (`--font-inter`)
  - Headings: `Poppins` (`--font-poppins`, gewichten `500/600/700`)
- Admin:
  - Geen custom font ingesteld; standaard Tailwind sans stack.

### 3.2 Font weights in gebruik
- `font-normal`, `font-medium`, `font-semibold`, `font-bold`.

### 3.3 Font sizes in gebruik
- `text-[11px]`
- `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`, `text-6xl`

### 3.4 Line heights
- Expliciet gebruikt: `leading-none`, `leading-tight`, `leading-6`, `leading-7`.

### 3.5 Heading-stijl
- Globaal: alle `h1..h6` krijgen `font-heading`.
- Veelgebruikte patronen:
  - `h1`: `text-2xl` of `text-3xl` + `font-bold`
  - Hero/product: tot `text-6xl`
  - `h2`: vaak `text-lg`/`text-xl` + `font-semibold`

### 3.6 Body text-stijl
- Standaard body: `font-body`, `--snack-text` op `--snack-bg`.
- Secundaire copy: meestal `text-sm` of `text-xs` met `text-snack-muted`.

## 4. Layout en spacing
### 4.1 Containers en breedtes
- Veelgebruikte max-widths: `max-w-sm`, `max-w-md`, `max-w-lg`, `max-w-2xl`, `max-w-3xl`, `max-w-6xl`.
- Horizontale page-padding meestal `px-4`.

### 4.2 Grid en responsiviteit
- Veelgebruikte grids: `grid-cols-1/2/3`, `sm:grid-cols-2/3`, `md:grid-cols-2/3`.
- Productpagina gebruikt ook custom kolommen (`md:grid-cols-[1.2fr_0.8fr]`, `md:grid-cols-[0.95fr_1.05fr]`).
- Breakpoints in gebruik: vooral `sm` en `md`.

### 4.3 Spacing-schaal (gebruikte utilities)
- Kernwaarden: `1`, `2`, `3`, `4`, `5`, `6`, `8` voor `p/m/gap`.
- Grotere sectie-afstanden: `10`, `12`, `14`, `16`, `20`, `24`.
- Component spacing vaak `gap-2/3/4`, `space-y-3/4`.

### 4.4 Border radius
- Primair: `rounded-xl`.
- Overig: `rounded-lg`, `rounded-2xl`, `rounded-full`, `rounded-md`, `rounded-sm`, plus custom `rounded-[1.5rem]` en `rounded-[1.75rem]`.

### 4.5 Shadows
- Basiskaarten: subtiel (`shadow-sm` + custom `0 1px 2px rgba(15, 23, 42, 0.04)`).
- Overlays/popovers: `shadow-lg` of `shadow-xl`.
- Product hero gebruikt ook custom diepe schaduw (`shadow-[0_18px_45px_rgba(15,23,42,0.08)]`).

### 4.6 Navigatie-layout
- Desktop topnav (`h-16`, sticky).
- Mobiele topbar (`h-14`) + bottom nav (`h-[4.5rem]`) met safe-area padding (`pb-nav` / `env(safe-area-inset-bottom)`).

## 5. Component styling
### 5.1 Buttons
- Web:
  - `.btn-primary`: oranje, wit label, `rounded-xl`, min hoogte `44px`.
  - `.btn-secondary`: witte achtergrond, grijze border.
  - `.btn-ghost`: tekst-variant, subtiele hover.
- Admin:
  - `.btn` basis + `.btn-primary`, `.btn-secondary`, `.btn-danger`.

### 5.2 Input velden
- `.input`: `rounded-xl`, lichte border, witte achtergrond, `text-sm`, focusring in primaire kleur.
- `.label`: `text-sm font-medium`, muted kleur.
- Mobile anti-zoom: `font-size: 16px` voor form controls onder `768px`.

### 5.3 Cards
- Kernpatroon: witte achtergrond, lichte border, `rounded-xl`, subtiele schaduw.
- Web card-padding varieert per component (`p-3` t/m `p-6`); admin-card heeft standaard `p-6`.

### 5.4 Navigatie
- Web: topnav + bottomnav met semi-transparante witte achtergrond (`bg-white/90-95`) en blur.
- Admin: vaste donkere sidebar (`bg-slate-950`) met actieve oranje itemhighlight.

### 5.5 Modals / overlays
- Patroon: `fixed inset-0`, semi-transparante zwarte backdrop (`bg-black/35`, `bg-black/50`, `bg-black/90`), inhoud op witte kaart met afgeronde hoeken.
- Toegepast bij profielafbeelding lightbox, image lightbox, account delete, admin reset/create modals.

### 5.6 Alerts / meldingen
- Inline meldingen zijn kleurgecodeerde blokken met zachte achtergrond + border.
- Veel gebruikt voor validatie, errors, successtatus en informatieblokken.

### 5.7 Dropdowns / panelen
- Geen centrale dropdown-component.
- Concreet aanwezig:
  - Notificatiepanel (floating panel rechtsboven)
  - Mention-suggesties
  - Place search-result dropdown
  - `details/summary` voor report-paneel

### 5.8 Tabellen (admin)
- `.table` met `border-collapse`, header op `snack.surface`, row hover op `snack.surface`.

## 6. Icon systeem
### 6.1 Gebruikte icon sets
- `lucide-react` (alleen kaartcontrols in mapcomponent).
- Verder vooral custom inline SVG’s en emoji-icoonlabels.

### 6.2 Iconstijl
- Navigatie-icoontjes: custom SVG outline (stroke `currentColor`, meestal `strokeWidth=2`).
- Map controls (Lucide): outline icons, compact (`size-4`/`size-5`).
- Map markers: custom filled pinvormen.
- Admin dashboards/sidebar: emoji als visuele iconen.

### 6.3 Icon grootte en kleur
- Veelgebruikte maten: `h-4`/`w-4`, `h-5`/`w-5`, `h-6`/`w-6`.
- Kleur volgt tekstkleur via `currentColor`; belangrijke iconen in primaire/accent kleuren.

### 6.4 Toepassingsgebieden
- Navigatie, notificaties, kaartbediening, ratings, statusbadges, empty states en action knoppen.

### 6.5 Favicon en app icon
- Favicon set aanwezig in meerdere formaten (`16`, `32`, `48`, `64` + `.ico`).
- PWA icons: `128`, `192`, `256`, `384`, `512`, plus `1024` app icon.

## 7. Logo en branding
- Hoofdlogo is een tekstlogo in code:
  - `Snack` in `snack-primary`
  - `Sp` + pin-vormige SVG-glyph + `t` in `snack-accent`
- Dit logo komt terug in topnav, auth-schermen, mobile brand bar, productpagina en e-mails.
- Branding-assets aanwezig:
  - `apps/web/app/icon.png` (1024x1024)
  - `apps/web/app/apple-icon.png` (180x180)
  - `apps/web/public/icons/*` varianten voor favicon/PWA
- OpenGraph/Twitter image gebruikt een oranje gradient branding-achtergrond.

## 8. Design principes
- Licht, helder en mobiel-eerst: veel wit en zachte grijsvlakken.
- Sterke primaire actiehiërarchie: oranje voor hoofdacties, rood voor risico/destructief.
- Consistente afgeronde vormen: `rounded-xl` als dominante radius.
- Functionele visualisatie: statuskleuren direct gekoppeld aan moderation/feedback states.
- Subtiele diepte en motion: lichte schaduwen, korte transities, geen zware effecten.
- Component-hergebruik via utility classes (`btn-*`, `card`, `input`, `label`) met dezelfde tokenbasis in web en admin.
