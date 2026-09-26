import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Voorwaarden',
  description:
    'De regels voor het gebruik van SnackSpot: wie mag meedoen, je account, wat je mag plaatsen, moderatie en de juridische basis.',
  alternates: { canonical: '/terms' },
}

// Plain-language terms for a user-generated-content platform. Covers eligibility
// (GDPR Art. 8 age threshold), the licence users grant on their content, the
// DSA notice-and-action duty (kept in sync with the Report/Moderation flow), and
// Dutch governing law. Company-identifying details live on /imprint.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-snack-text">Voorwaarden</h1>
        <p className="text-sm text-snack-muted mt-1">Laatst bijgewerkt: 25 september 2026</p>
      </div>

      <div className="card p-5 space-y-3">
        <p className="text-sm text-snack-muted">
          Deze voorwaarden zijn een overeenkomst tussen jou en SnackSpot (&ldquo;SnackSpot&rdquo;,
          &ldquo;wij&rdquo;, &ldquo;ons&rdquo;). Ze beschrijven de regels voor het gebruik van de app en de website.
          Door een account te maken of SnackSpot te gebruiken ga je akkoord met deze voorwaarden. Ben je het er
          niet mee eens, gebruik de dienst dan niet. Wie SnackSpot beheert, staat op de pagina met onze{' '}
          <Link href="/imprint" className="text-snack-primary hover:underline">bedrijfsgegevens</Link>.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">1. Wie SnackSpot mag gebruiken</h2>
        <p className="text-sm text-snack-muted">
          Je moet minstens <strong className="text-snack-text">16 jaar oud</strong> zijn om een account
          te maken. Door je te registreren bevestig je dat je aan deze leeftijdsgrens voldoet. SnackSpot is
          gratis; we vragen niet om betaalgegevens.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">2. Je account</h2>
        <ul className="list-disc pl-5 text-sm text-snack-muted space-y-1">
          <li>Je bent zelf verantwoordelijk voor het veilig houden van je inloggegevens en voor wat er met je account gebeurt.</li>
          <li>Geef juiste informatie en gebruik één account per persoon. Doe je niet voor als iemand anders.</li>
          <li>Je kunt je profiel aanpassen, je gegevens downloaden of je account verwijderen wanneer je wilt, in{' '}
            <Link href="/profile?tab=settings" className="text-snack-primary hover:underline">Instellingen</Link>.</li>
        </ul>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">3. Wat je mag plaatsen</h2>
        <p className="text-sm text-snack-muted">
          Op SnackSpot deel je reviews, cijfers, foto&apos;s en reacties. Je plaatst geen content die:
        </p>
        <ul className="list-disc pl-5 text-sm text-snack-muted space-y-1">
          <li>onrechtmatig, lasterlijk, intimiderend, haatdragend of bedreigend is;</li>
          <li>onjuist of misleidend is, of waarvoor je betaald bent zonder dat te vermelden;</li>
          <li>inbreuk maakt op het intellectueel eigendom, de privacy of andere rechten van een ander;</li>
          <li>herkenbare personen toont zonder dat je een redelijke grond hebt om hun beeld te delen;</li>
          <li>spam of malware bevat, of bedoeld is om de dienst te verstoren of te misbruiken.</li>
        </ul>
        <p className="text-sm text-snack-muted">
          Reviews moeten over je eigen ervaring gaan. Eerlijke kritiek is welkom; bewust onjuiste of
          schadelijke uitspraken over een zaak niet.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">4. Je content blijft van jou</h2>
        <p className="text-sm text-snack-muted">
          Alles wat je plaatst, blijft van jou. Om de dienst te kunnen leveren geef je SnackSpot een
          niet-exclusieve, wereldwijde, kosteloze licentie om je content te hosten, op te slaan, te
          verveelvoudigen en te tonen binnen de app en de functies ervan (bijvoorbeeld je review op de
          pagina van een snackplek of in de feed). Deze licentie eindigt als je de content of je account
          verwijdert, behalve voor kopieën die we wettelijk moeten bewaren of die anderen al rechtmatig
          hebben gedeeld.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">5. Moderatie, meldingen en verwijderen</h2>
        <p className="text-sm text-snack-muted">
          Iedereen kan een review of foto melden via de meldoptie bij dat item. We bekijken meldingen
          en kunnen content verbergen, verwijderen of beperken, en accounts waarschuwen, schorsen of
          blokkeren als content in strijd is met deze voorwaarden of de wet. Als we je content verwijderen
          of je account beperken, proberen we je de reden te laten weten. Vind je een besluit onterecht, dan
          kun je bezwaar maken door contact met ons op te nemen. Rechthebbenden kunnen content die inbreuk
          maakt op hun rechten melden via het contactadres op de pagina met onze{' '}
          <Link href="/imprint" className="text-snack-primary hover:underline">bedrijfsgegevens</Link>.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">6. Gegevens van snackplekken en derden</h2>
        <p className="text-sm text-snack-muted">
          Namen, adressen en kaartgegevens van zaken komen deels van{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-snack-primary hover:underline">OpenStreetMap</a>,
          &copy; OpenStreetMap-bijdragers, beschikbaar onder de Open Database Licence (ODbL). SnackSpot
          gebruikt een klein aantal externe dienstverleners; die staan op onze pagina met{' '}
          <Link href="/subprocessors" className="text-snack-primary hover:underline">subverwerkers</Link>.
          Hoe we met je persoonsgegevens omgaan, lees je in onze{' '}
          <Link href="/privacy" className="text-snack-primary hover:underline">privacyverklaring</Link>.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">7. Beschikbaarheid en aansprakelijkheid</h2>
        <p className="text-sm text-snack-muted">
          SnackSpot wordt aangeboden &ldquo;zoals het is&rdquo;. We doen ons best om de dienst draaiende te
          houden, maar kunnen niet garanderen dat die altijd zonder onderbreking of fouten werkt. Reviews zijn
          de mening van gebruikers, niet van SnackSpot. Voor zover de wet dat toestaat, zijn we niet
          aansprakelijk voor indirecte schade of gevolgschade. Niets in deze voorwaarden beperkt
          aansprakelijkheid die volgens Nederlands recht niet uitgesloten kan worden, waaronder je wettelijke
          rechten als consument.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">8. Stoppen met SnackSpot</h2>
        <p className="text-sm text-snack-muted">
          Je kunt op elk moment stoppen met SnackSpot en je account verwijderen. We kunnen je toegang
          schorsen of beëindigen als je deze voorwaarden ernstig of herhaaldelijk overtreedt, of als de wet
          ons daartoe verplicht.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">9. Wijzigingen</h2>
        <p className="text-sm text-snack-muted">
          We kunnen deze voorwaarden aanpassen als de dienst verandert. Bij belangrijke wijzigingen passen we
          de datum hierboven aan en laten we het je waar nodig in de app weten. Gebruik je SnackSpot na een
          wijziging, dan ga je akkoord met de nieuwe voorwaarden.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">10. Toepasselijk recht en contact</h2>
        <p className="text-sm text-snack-muted">
          Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de
          bevoegde Nederlandse rechter, zonder dat dit afdoet aan dwingende bescherming in het land waar je
          woont. Vragen? Mail ons op{' '}
          <a href="mailto:contact@snackspot.online" className="text-snack-primary hover:underline">contact@snackspot.online</a>.
        </p>
      </div>
    </div>
  )
}
