-- Cuisine passport sets (product-vision hoofdstuk 3 B9 — het keukenpaspoort).
-- Earnable as soon as admins assign places.cuisine; the CUISINE_MATCH and
-- UNIQUE_CUISINES evaluators ship with this change.

-- ── Set: World tour — a stamp per cuisine reviewed ───────────────────────────
INSERT INTO collectibles (set_key, item_key, name, description, icon, criteria, sort_order) VALUES
  ('world-tour', 'dutch',      'Dutch',      'Review a Dutch place.',      '🇳🇱', '{"type":"CUISINE_MATCH","cuisine":"dutch"}', 1),
  ('world-tour', 'snackbar',   'Snackbar',   'Review a snackbar.',         '🍟', '{"type":"CUISINE_MATCH","cuisine":"snackbar"}', 2),
  ('world-tour', 'surinamese', 'Surinamese', 'Review a Surinamese place.', '🇸🇷', '{"type":"CUISINE_MATCH","cuisine":"surinamese"}', 3),
  ('world-tour', 'indonesian', 'Indonesian', 'Review an Indonesian place.','🇮🇩', '{"type":"CUISINE_MATCH","cuisine":"indonesian"}', 4),
  ('world-tour', 'turkish',    'Turkish',    'Review a Turkish place.',    '🇹🇷', '{"type":"CUISINE_MATCH","cuisine":"turkish"}', 5),
  ('world-tour', 'italian',    'Italian',    'Review an Italian place.',   '🇮🇹', '{"type":"CUISINE_MATCH","cuisine":"italian"}', 6),
  ('world-tour', 'chinese',    'Chinese',    'Review a Chinese place.',    '🇨🇳', '{"type":"CUISINE_MATCH","cuisine":"chinese"}', 7),
  ('world-tour', 'japanese',   'Japanese',   'Review a Japanese place.',   '🇯🇵', '{"type":"CUISINE_MATCH","cuisine":"japanese"}', 8),
  ('world-tour', 'thai',       'Thai',       'Review a Thai place.',       '🇹🇭', '{"type":"CUISINE_MATCH","cuisine":"thai"}', 9),
  ('world-tour', 'vietnamese', 'Vietnamese', 'Review a Vietnamese place.', '🇻🇳', '{"type":"CUISINE_MATCH","cuisine":"vietnamese"}', 10),
  ('world-tour', 'indian',     'Indian',     'Review an Indian place.',    '🇮🇳', '{"type":"CUISINE_MATCH","cuisine":"indian"}', 11),
  ('world-tour', 'mexican',    'Mexican',    'Review a Mexican place.',    '🇲🇽', '{"type":"CUISINE_MATCH","cuisine":"mexican"}', 12);

-- ── Set: Taste tourist — distinct cuisines reviewed ──────────────────────────
INSERT INTO collectibles (set_key, item_key, name, description, icon, criteria, sort_order) VALUES
  ('taste-tourist', 'three-cuisines', 'Taste Tourist',  'Review 3 different cuisines.', '🧳',
   '{"type":"UNIQUE_CUISINES","value":3}', 1),
  ('taste-tourist', 'five-cuisines',  'Taste Explorer', 'Review 5 different cuisines.', '🗽',
   '{"type":"UNIQUE_CUISINES","value":5}', 2),
  ('taste-tourist', 'eight-cuisines', 'World Eater',    'Review 8 different cuisines.', '🌏',
   '{"type":"UNIQUE_CUISINES","value":8}', 3);
