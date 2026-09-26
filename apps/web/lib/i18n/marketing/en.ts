import type { MarketingDict } from '../types'

export const en: MarketingDict = {
  meta: {
    productTitle: 'Snack bar reviews per dish, with photos | SnackSpot',
    productDescription:
      'Read and write photo reviews of snack bars and other snack spots, per dish. Free, in your browser and written by real visitors.',
    productSocialTitle: 'Know what to order | SnackSpot',
    productSocialDescription:
      'Photo reviews per dish of snack bars and other snack spots. See what people really ate before you order.',
  },
  product: {
    heroTitle: 'Know what to order before you reach the counter.',
    heroLead:
      'SnackSpot collects photo reviews of snack bars and other snack spots, per dish. Search for a spot, read what others ate there, write your own review and save places you still want to try. Every review comes from a real visitor, and there are no sponsored spots.',
    ctaPrimary: 'Create account',
    ctaSecondary: 'See recent reviews',
    heroFinePrint: 'Free. Runs in your browser on any phone, no app store needed.',
    counts: 'Now {reviews} photo reviews of {places} snack spots in {cities} cities.',

    stripTitle: 'Just eaten',
    stripAll: 'See everything',

    rankingTitle: 'Not “is this place good?”, but “what should I order here?”',
    rankingBody:
      'Every review on SnackSpot is about one dish. That way you see, per city, which snack spots score highest for kapsalon, fries or a sandwich.',
    rankingCaption: '{city}: top-rated {dish}',
    rankingLink: 'See the full ranking',
    reviewsOne: '1 review',
    reviewsMany: '{n} reviews',

    claims: [
      {
        title: 'Per dish, not per place.',
        body: 'A score for taste, value and portion, per dish. That way a 4 actually means something.',
      },
      {
        title: 'Photo first.',
        body: 'You see what actually came over the counter, not the photo on the menu board.',
      },
      {
        title: 'Real visitors, no ads.',
        body: 'Reviews come from people who ate there themselves. No advertising and no sponsored spots.',
      },
    ],

    stepsTitle: 'How it works',
    steps: [
      { title: 'Take a photo of your food', body: 'Photo first, then eat. You can add up to five photos per review.' },
      { title: 'Rate the dish', body: 'Give stars for taste, value and portion, and add which dish it was.' },
      { title: 'Pick the spot and post your review', body: 'Your review shows up in the feed and on the spot’s page right away. Sharing to WhatsApp takes one tap.' },
    ],

    citiesTitle: 'By city',
    citiesBody: 'Every city with reviews has its own page of snack spots, ranked by visitors’ scores.',
    citiesAll: 'All cities',
    placesOne: '1 snack spot',
    placesMany: '{n} snack spots',

    faqTitle: 'Frequently asked questions',
    faqs: [
      {
        q: 'What is SnackSpot?',
        a: 'A free site with photo reviews of snack bars and other snack spots. Every review is about one dish, with scores for taste, value, portion and optionally service.',
      },
      {
        q: 'Is SnackSpot free?',
        a: 'Yes. No subscription, no ads and no sponsored spots.',
      },
      {
        q: 'Can I browse without an account?',
        a: 'Yes. Searching and reading reviews works without an account. To post a review or save a snack spot you need a free account.',
      },
      {
        q: 'Do I need to download an app?',
        a: 'No. SnackSpot runs in your browser. On your phone you can add it to your home screen, and it then opens like an app.',
      },
      {
        q: 'How is this different from Google Maps?',
        a: 'Google Maps scores a place. SnackSpot scores a dish, with a photo of what you actually got. So you know not just whether a snack bar is good, but also what to order there.',
      },
      {
        q: 'Do I have to write a long review?',
        a: 'No. Photos, scores and a few sentences are enough.',
      },
      {
        q: 'Who sees my reviews?',
        a: 'Everyone. Reviews and profiles are public, so others can use them. You choose your username and what you share.',
      },
    ],

    finalTitle: 'Eaten somewhere yourself?',
    finalBody: 'Create an account and post your first review. Then the next person at the counter knows what to order.',
    finalButton: 'Create account',
    finalFinePrint: 'Free. Works on any phone.',
  },
  nav: {
    howItWorks: 'How it works',
    cities: 'Snack spots',
    guides: 'Guides',
    releases: 'Updates',
    login: 'Log in',
    createAccount: 'Create account',
  },
  footer: {
    terms: 'Terms',
    privacy: 'Privacy',
    subprocessors: 'Sub-processors',
    imprint: 'Company info',
  },
  switcher: { label: 'Language', en: 'English', nl: 'Nederlands' },
  releasesChrome: {
    title: 'What’s new',
    intro: 'New features, improvements and fixes in SnackSpot.',
    metaTitle: 'What’s new | SnackSpot',
    metaDescription: 'All SnackSpot updates in one place: new features, improvements and fixes, with the date each one went live.',
    eyebrow: 'Updates',
  },
}
