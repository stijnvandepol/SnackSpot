-- Dutch names and descriptions for the badge, daily-quest and stamp catalogs.
--
-- These strings are seeded data (migrations 006, 014, 029, 030, 031) and are shown as-is on
-- the profile, in notifications and in e-mails, so they were the last English text a Dutch
-- visitor still saw. Rows are matched on their stable keys; nothing else changes. "Post" in
-- the old copy means a published review (badge-service counts reviews), so it says review.
--
-- user_quests copies title/description from the template when a quest is assigned, so the
-- already-assigned rows are updated too. Notifications already sent keep their old text.

UPDATE badges AS b SET name = v.name, description = v.description
FROM (VALUES
  ('first-post',            'Eerste hap',            'Plaats je eerste review.'),
  ('five-posts',            'Op het menu',           'Plaats 5 reviews.'),
  ('ten-posts',             'Vaste reviewer',        'Plaats 10 reviews.'),
  ('twenty-five-posts',     'Snackcriticus',         'Plaats 25 reviews.'),
  ('reviewer-silver',       'Reviewer',              'Plaats 10 reviews.'),
  ('reviewer-gold',         'Reviewer',              'Plaats 50 reviews.'),
  ('month-5',               'Lekker bezig',          'Plaats 5 reviews in 30 dagen.'),
  ('month-15',              'Niet te stoppen',       'Plaats 15 reviews in 30 dagen.'),
  ('consistent',            'Vaste gast',            'Plaats een review op 7 verschillende dagen.'),
  ('streak-3',              'Warmgedraaid',          'Plaats 3 dagen achter elkaar een review.'),
  ('streak-7',              'Op dreef',              'Plaats 7 dagen achter elkaar een review.'),
  ('streak-14',             'Onvermoeibaar',         'Plaats 14 dagen achter elkaar een review.'),
  ('local-explorer',        'Lokale ontdekker',      'Review 5 verschillende snackplekken.'),
  ('local-explorer-silver', 'Lokale ontdekker',      'Review 5 verschillende snackplekken.'),
  ('local-explorer-gold',   'Lokale ontdekker',      'Review 20 verschillende snackplekken.'),
  ('city-taster',           'Stadsproever',          'Review 15 verschillende snackplekken.'),
  ('likes-10',              'Buurtfavoriet',         'Krijg 10 likes op je reviews.'),
  ('top-rated',             'Goed gewaardeerd',      'Krijg 25 likes op je reviews.'),
  ('likes-50',              'Publiekslieveling',     'Krijg 50 likes op je reviews.'),
  ('comments-10',           'Gespreksstof',          'Krijg 10 reacties op je reviews.'),
  ('comments-25',           'Praat van de buurt',    'Krijg 25 reacties op je reviews.')
) AS v(slug, name, description)
WHERE b.slug = v.slug;

UPDATE quest_templates AS q SET title = v.title, description = v.description
FROM (VALUES
  ('daily-bite',       'Log een bite',              'Eén foto van iets wat je vandaag eet.'),
  ('daily-bites-3',    'Log 3 bites',               'Ontbijt, lunch en avondeten: leg ze alle drie vast.'),
  ('daily-place-bite', 'Log een bite bij een plek', 'Eet je buiten de deur of haal je een snack? Koppel de plek.'),
  ('daily-review',     'Plaats een review',         'Maak van een goede maaltijd een volledige review.'),
  ('daily-comment',    'Laat een reactie achter',   'Laat iemand weten dat je trek kreeg van hun foto.'),
  ('daily-likes-3',    'Like 3 reviews',            'Geef andere snackfans wat waardering in de feed.')
) AS v(key, title, description)
WHERE q.key = v.key;

UPDATE user_quests AS uq SET title = q.title, description = q.description
FROM quest_templates AS q
WHERE uq.template_id = q.id;

UPDATE collectibles AS c SET name = v.name, description = v.description
FROM (VALUES
  ('spot-milestones', 'first-spot',       'Eerste plek',       'Review je eerste snackplek.'),
  ('spot-milestones', 'five-spots',       'Plekkenverzamelaar', 'Review 5 verschillende snackplekken.'),
  ('spot-milestones', 'ten-spots',        'Plekkenjager',      'Review 10 verschillende snackplekken.'),
  ('spot-milestones', 'twentyfive-spots', 'Plekkenlegende',    'Review 25 verschillende snackplekken.'),
  ('city-explorer',   'two-cities',       'Dagjesmens',        'Review snackplekken in 2 verschillende steden.'),
  ('city-explorer',   'three-cities',     'Op pad',            'Review snackplekken in 3 verschillende steden.'),
  ('city-explorer',   'five-cities',      'Snacknomade',       'Review snackplekken in 5 verschillende steden.'),
  ('taste-tourist',   'three-cuisines',   'Smaaktoerist',      'Review 3 verschillende keukens.'),
  ('taste-tourist',   'five-cuisines',    'Smaakontdekker',    'Review 5 verschillende keukens.'),
  ('taste-tourist',   'eight-cuisines',   'Wereldeter',        'Review 8 verschillende keukens.'),
  ('dutch-classics',  'stroopwafel',      'Stroopwafel',       'Review een stroopwafel.'),
  ('dutch-classics',  'haring',           'Haring',            'Review een haring. Hollandse Nieuwe mag ook.'),
  ('dutch-classics',  'bitterballen',     'Bitterballen',      'Review bitterballen.'),
  ('dutch-classics',  'kapsalon',         'Kapsalon',          'Review een kapsalon.'),
  ('dutch-classics',  'kibbeling',        'Kibbeling',         'Review kibbeling.'),
  ('world-tour',      'dutch',            'Hollands',          'Review een Hollandse zaak.'),
  ('world-tour',      'snackbar',         'Snackbar',          'Review een snackbar.'),
  ('world-tour',      'surinamese',       'Surinaams',         'Review een Surinaamse zaak.'),
  ('world-tour',      'indonesian',       'Indonesisch',       'Review een Indonesische zaak.'),
  ('world-tour',      'turkish',          'Turks',             'Review een Turkse zaak.'),
  ('world-tour',      'italian',          'Italiaans',         'Review een Italiaanse zaak.'),
  ('world-tour',      'chinese',          'Chinees',           'Review een Chinese zaak.'),
  ('world-tour',      'japanese',         'Japans',            'Review een Japanse zaak.'),
  ('world-tour',      'thai',             'Thais',             'Review een Thaise zaak.'),
  ('world-tour',      'vietnamese',       'Vietnamees',        'Review een Vietnamese zaak.'),
  ('world-tour',      'indian',           'Indiaas',           'Review een Indiase zaak.'),
  ('world-tour',      'mexican',          'Mexicaans',         'Review een Mexicaanse zaak.')
) AS v(set_key, item_key, name, description)
WHERE c.set_key = v.set_key AND c.item_key = v.item_key;
