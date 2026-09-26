import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacyverklaring',
  description:
    'Welke persoonsgegevens SnackSpot bewaart, waarom, hoe lang, en hoe je je rechten onder de AVG gebruikt. In gewone taal uitgelegd.',
  alternates: { canonical: '/privacy' },
}

// GDPR Art. 13/14 transparency: plain-language description of processing,
// retention and data-subject rights. Keep in sync with the retention jobs in
// apps/worker and the export contents in lib/export-data.ts.
export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-snack-text">Privacyverklaring</h1>
        <p className="text-sm text-snack-muted mt-1">Laatst bijgewerkt: 25 september 2026</p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">Wat we bewaren</h2>
        <ul className="list-disc pl-5 text-sm text-snack-muted space-y-1">
          <li><strong className="text-snack-text">Account:</strong> e-mailadres, gebruikersnaam, wachtwoord (opgeslagen als Argon2id-hash, nooit leesbaar) en eventueel je bio, profielfoto en tijdzone.</li>
          <li><strong className="text-snack-text">Wat je zelf plaatst:</strong> reviews, cijfers, foto&apos;s, reacties, likes, bites, favorieten en wie je volgt.</li>
          <li><strong className="text-snack-text">Foto&apos;s:</strong> uploads worden opnieuw gecodeerd en <em>alle metadata, ook de GPS-locatie, wordt verwijderd</em> voordat iemand ze te zien krijgt.</li>
          <li><strong className="text-snack-text">Activiteit:</strong> badges, XP, opdrachten, verzamelobjecten en meldingen die ontstaan doordat je de app gebruikt.</li>
          <li><strong className="text-snack-text">Technisch:</strong> sessietokens (gehasht) en pushabonnementen als je pushmeldingen aanzet.</li>
        </ul>
        <p className="text-sm text-snack-muted">
          We gebruiken geen tracking- of advertentiecookies, alleen één functionele sessiecookie
          zodat je ingelogd blijft. Die cookie is strikt noodzakelijk, daarom is er geen
          cookiebanner. We verkopen je gegevens nooit.
        </p>
        <p className="text-sm text-snack-muted">
          <strong className="text-snack-text">Gebruiksstatistieken.</strong> Om te zien welke delen van
          SnackSpot werken, tellen we per dag hoe vaak bepaalde stappen gebeuren, zoals &quot;een pagina
          van een snackplek is bekeken&quot; of &quot;er is een account gemaakt&quot;, plus metingen van de
          laadsnelheid (Core Web Vitals). Deze tellingen zijn anoniem: er wordt geen cookie, geen
          IP-adres, geen account-id en geen surfgeschiedenis bij opgeslagen, dus ze zijn niet aan jou
          te koppelen. De dagtotalen bewaren we ongeveer 13 maanden.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">Waarom we dit verwerken</h2>
        <ul className="list-disc pl-5 text-sm text-snack-muted space-y-1">
          <li>Om de dienst te leveren: je account, je content en de feed (overeenkomst, art. 6 lid 1 sub b AVG).</li>
          <li>Om het platform veilig te houden: limieten op het aantal verzoeken, meldingen van misbruik en moderatie (gerechtvaardigd belang, art. 6 lid 1 sub f). Voor die limieten verwerken we kort je IP-adres; de tellers verlopen binnen enkele uren vanzelf.</li>
          <li>Om de dienst te verbeteren met anonieme gebruikstellingen (gerechtvaardigd belang, art. 6 lid 1 sub f); zie hierboven.</li>
          <li>Om optionele e-mails en pushmeldingen te sturen, alleen met je toestemming en per soort in te stellen in Instellingen (art. 6 lid 1 sub a).</li>
        </ul>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">Hoe lang we het bewaren</h2>
        <ul className="list-disc pl-5 text-sm text-snack-muted space-y-1">
          <li><strong className="text-snack-text">Je account en content:</strong> tot je ze verwijdert. Als je je account verwijdert, wissen we alles direct, ook je foto&apos;s uit de opslag.</li>
          <li><strong className="text-snack-text">Verwijderde reviews:</strong> 30 dagen terug te zetten, daarna definitief gewist, inclusief foto&apos;s.</li>
          <li><strong className="text-snack-text">Verwijderde foto&apos;s en reacties:</strong> direct gewist.</li>
          <li><strong className="text-snack-text">Tokens voor inloggen en wachtwoordherstel:</strong> tot ze verlopen; we ruimen ze dagelijks op.</li>
          <li><strong className="text-snack-text">Geüploade foto&apos;s die niet gebruikt worden:</strong> dagelijks automatisch verwijderd.</li>
        </ul>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">Je rechten</h2>
        <ul className="list-disc pl-5 text-sm text-snack-muted space-y-1">
          <li><strong className="text-snack-text">Inzage en overdraagbaarheid</strong> (art. 15/20): download al je gegevens als machineleesbare JSON, samen met je foto&apos;s, via <Link href="/profile?tab=settings" className="text-snack-primary hover:underline">Instellingen → Privacy en gegevens</Link>.</li>
          <li><strong className="text-snack-text">Rectificatie</strong> (art. 16): pas je profiel, reviews en voorkeuren op elk moment aan in de app.</li>
          <li><strong className="text-snack-text">Verwijdering</strong> (art. 17): verwijder losse reviews, foto&apos;s en reacties, of je hele account, via <Link href="/profile?tab=settings" className="text-snack-primary hover:underline">Instellingen</Link>. Verwijderen is echt verwijderen: de gegevens gaan uit onze database en bestandsopslag, ze worden niet alleen verborgen.</li>
          <li><strong className="text-snack-text">Toestemming intrekken</strong> (art. 7): zet elke soort e-mail- of pushmelding uit in Instellingen.</li>
          <li><strong className="text-snack-text">Klacht indienen</strong> (art. 77): je kunt een klacht indienen bij je toezichthouder (in Nederland: de Autoriteit Persoonsgegevens).</li>
        </ul>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">Waar je gegevens staan</h2>
        <p className="text-sm text-snack-muted">
          Alle gegevens staan op de eigen infrastructuur van SnackSpot (een PostgreSQL-database en
          S3-compatibele opslag). Servicemails versturen we via onze e-mailprovider, die je
          e-mailadres alleen gebruikt om het bericht af te leveren. Privacygevoelige acties
          (account verwijderen, gegevens downloaden) leggen we vast in een auditlog. Daarin staan
          geen persoonsgegevens behalve een interne id.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-snack-text">Contact</h2>
        <p className="text-sm text-snack-muted">
          Vragen over je gegevens? Mail ons op{' '}
          <a href="mailto:contact@snackspot.online" className="text-snack-primary hover:underline">
            contact@snackspot.online
          </a>.
        </p>
      </div>
    </div>
  )
}
