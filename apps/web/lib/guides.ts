export interface GuideDefinition {
  href: string
  title: string
  description: string
}

export const PILLAR_GUIDES: GuideDefinition[] = [
  {
    href: '/guides/add-snackspot-to-home-screen',
    title: 'SnackSpot op je beginscherm zetten (iPhone en Android)',
    description:
      'Zet SnackSpot als icoon op het beginscherm van je telefoon. Met stappen voor iPhone en Android en oplossingen als het niet lukt.',
  },
  {
    href: '/guides/how-to-create-an-account',
    title: 'Een account maken',
    description:
      'Maak in een paar stappen een gratis account, zodat je reviews kunt plaatsen, kunt liken en snackplekken kunt bewaren.',
  },
  {
    href: '/guides/how-to-change-your-password',
    title: 'Je wachtwoord wijzigen',
    description:
      'Wachtwoord vergeten of wil je een nieuw wachtwoord? Zo stel je het opnieuw in via een link in je mail.',
  },
  {
    href: '/guides/how-to-delete-your-account',
    title: 'Je account verwijderen',
    description:
      'Verwijder je account en al je gegevens definitief via je profielinstellingen.',
  },
  {
    href: '/guides/how-to-post-a-review',
    title: 'Een review plaatsen',
    description:
      'Plaats een review met foto’s van een gerecht: foto’s toevoegen, cijfers geven, snackplek kiezen en plaatsen.',
  },
  {
    href: '/guides/how-to-add-a-place',
    title: 'Een snackplek toevoegen',
    description:
      'Staat een snackplek nog niet op SnackSpot? Dan voeg je hem toe terwijl je een review plaatst.',
  },
]
