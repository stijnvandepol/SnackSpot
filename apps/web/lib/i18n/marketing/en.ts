import type { MarketingDict } from '../types'

export const en: MarketingDict = {
  meta: {
    productTitle: 'Know what to order before you sit down | SnackSpot',
    productDescription:
      'SnackSpot collects photo reviews per dish from small local eateries: snack bars, cafeterias and sandwich shops. Free, in your browser, made by people who actually ate there.',
    productSocialTitle: 'Know what to order | SnackSpot',
    productSocialDescription:
      'Photo reviews per dish from small eateries near you. See what people really ate before you order.',
  },
  product: {
    heroTitle: 'Know what to order before you sit down.',
    heroLead:
      'Photo reviews per dish from small local eateries: the snack bar on the corner, the cafeteria by the station, the sandwich shop only the neighbourhood knows. Made by people who actually ate there.',
    ctaPrimary: 'Create a free account',
    ctaSecondary: 'Browse the feed',
    heroFinePrint: 'Runs in your browser, on any phone. No app store needed.',
    counts: 'Now {reviews} photo reviews of {places} places in {cities} cities.',

    stripTitle: 'Just eaten',
    stripAll: 'See everything',

    rankingTitle: 'Not “is this place good?”, but “what should I order here?”',
    rankingBody:
      'Every review on SnackSpot is about one dish. That lets us do something a star average cannot: point out, per city, where the kapsalon, the fries or the sandwich is best.',
    rankingCaption: 'The best {dish} in {city}',
    rankingLink: 'See the full ranking',
    reviewsOne: '1 review',
    reviewsMany: '{n} reviews',

    claims: [
      {
        title: 'Per dish, not per place.',
        body: 'A score for taste, value and portion, per plate. That way a 4 actually means something.',
      },
      {
        title: 'Photo first.',
        body: 'You see the real plate, not the menu photo. Posting a review takes thirty seconds.',
      },
      {
        title: 'Small places only.',
        body: 'No chains, no sponsored spots. The places the big review sites skip.',
      },
    ],

    stepsTitle: 'How it works',
    steps: [
      { title: 'Photograph your food', body: 'Camera first, fork second. Up to five photos per review.' },
      { title: 'Rate the dish', body: 'Slide the stars for taste, value and portion. Name the dish.' },
      { title: 'Share it', body: 'Your review is live in the feed instantly and goes to WhatsApp in one tap.' },
    ],

    citiesTitle: 'By city',
    citiesBody: 'Every city with photo reviews has its own page, ranked by what visitors actually ate there.',
    citiesAll: 'All cities',
    placesOne: '1 place',
    placesMany: '{n} places',

    faqTitle: 'Frequently asked questions',
    faqs: [
      {
        q: 'What is SnackSpot?',
        a: 'A free community app for discovering small local eateries. Members share photo reviews of specific dishes, with a score for taste, value, portion and service.',
      },
      {
        q: 'Is SnackSpot free?',
        a: 'Yes, completely. No subscription, no ads, no sponsored placements.',
      },
      {
        q: 'Do I need to download an app?',
        a: 'No. SnackSpot runs in your browser and behaves like an app on your phone. You can add it to your home screen in two taps.',
      },
      {
        q: 'How is this different from Google Maps?',
        a: 'Google scores a place. SnackSpot scores a dish, with a photo of the real plate. So you know not just whether a place is good, but what to order there.',
      },
      {
        q: 'Do I have to write long reviews?',
        a: 'No. A review is photos, scores and a short note. Most take under a minute.',
      },
      {
        q: 'Who sees my reviews?',
        a: 'Reviews and profiles are public, that is the idea: your find helps the next person. You choose your username and what you share.',
      },
    ],

    finalTitle: 'Hungry? Start spotting.',
    finalBody: 'Create an account, post your first photo review and help the next person standing at the same counter.',
    finalButton: 'Create a free account',
    finalFinePrint: 'Thirty seconds. Works on any phone.',
  },
  nav: {
    howItWorks: 'How it works',
    cities: 'Cities',
    guides: 'Guides',
    releases: 'Release notes',
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
    title: 'Release notes',
    intro: 'What we have shipped: new features, improvements and fixes.',
    metaTitle: 'Release notes | SnackSpot',
    metaDescription: 'What is new in SnackSpot: features, improvements and fixes.',
    eyebrow: 'Changelog',
  },
}
