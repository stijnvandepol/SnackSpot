export interface GuideDefinition {
  href: string
  title: string
  description: string
}

export const PILLAR_GUIDES: GuideDefinition[] = [
  {
    href: '/guides/add-snackspot-to-home-screen',
    title: 'Add SnackSpot to your home screen (iOS & Android)',
    description:
      'Step-by-step instructions to add SnackSpot as a home screen icon on your phone, including troubleshooting tips.',
  },
  {
    href: '/guides/how-to-create-an-account',
    title: 'How to create an account',
    description:
      'Create a free SnackSpot account in under a minute so you can post reviews, like posts, and save your favourite spots.',
  },
  {
    href: '/guides/how-to-change-your-password',
    title: 'How to change your password',
    description:
      'Reset or update your SnackSpot password using the forgot-password flow or your account settings.',
  },
  {
    href: '/guides/how-to-delete-your-account',
    title: 'How to delete your account',
    description:
      'Permanently remove your SnackSpot account and all associated data from your profile settings.',
  },
  {
    href: '/guides/how-to-post-a-review',
    title: 'How to post a review',
    description:
      'Share a photo review of a local food spot — add a place, rate it, write your take, and publish in a few taps.',
  },
  {
    href: '/guides/how-to-add-a-place',
    title: 'How to add a place or restaurant',
    description:
      'If a spot is not on SnackSpot yet, you can add it yourself while posting a review.',
  },
]
