export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  servings INTEGER NOT NULL DEFAULT 2,
  allergies TEXT,
  dietary_preference TEXT,
  essential_spices TEXT NOT NULL DEFAULT '[]',
  available_equipment TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS ingredient (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  "group" TEXT NOT NULL,
  base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'cái')),
  conversions TEXT NOT NULL DEFAULT '{}',
  allergen_codes TEXT,
  reference_price REAL,
  price_updated_at TEXT,
  storage_rule_id TEXT,
  source TEXT,
  confirmed_by TEXT,
  missing_fields TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS recipe (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  servings_base INTEGER NOT NULL,
  total_minutes INTEGER NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  tags TEXT NOT NULL DEFAULT '[]',
  equipment TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('draft', 'reviewed', 'published')),
  reviewer TEXT,
  reviewed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  source TEXT,
  confirmed_by TEXT,
  missing_fields TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS recipe_ingredient (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredient(id),
  qty REAL NOT NULL,
  unit TEXT NOT NULL,
  amount_note TEXT,
  role TEXT NOT NULL CHECK (role IN ('flavor', 'structure', 'moisture', 'preservation', 'color')),
  flavor_group TEXT NOT NULL CHECK (flavor_group IN ('salt', 'sugar', 'acid', 'fat', 'spice', 'none')),
  optional INTEGER NOT NULL DEFAULT 0,
  "group" TEXT
);

CREATE TABLE IF NOT EXISTS recipe_step (
  id TEXT NOT NULL,
  recipe_id TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('active', 'passive')),
  seconds INTEGER NOT NULL,
  after TEXT NOT NULL DEFAULT '[]',
  resources TEXT NOT NULL DEFAULT '[]',
  cue TEXT,
  text TEXT NOT NULL,
  safety_rule TEXT,
  target_temperature REAL,
  PRIMARY KEY (recipe_id, id)
);

CREATE TABLE IF NOT EXISTS pantry_item (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredient(id),
  quantity REAL NOT NULL,
  base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'cái')),
  storage_location TEXT NOT NULL,
  added_at TEXT NOT NULL,
  opened_at TEXT,
  expiry_date TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'cook', 'shopping', 'photo'))
);

CREATE TABLE IF NOT EXISTS pantry_event (
  id TEXT PRIMARY KEY,
  pantry_item_id TEXT NOT NULL REFERENCES pantry_item(id),
  delta REAL NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('cook', 'adjust', 'discard', 'buy')),
  cook_session_id TEXT REFERENCES cook_session(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cook_session (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipe(id),
  recipe_version INTEGER NOT NULL,
  servings INTEGER NOT NULL,
  optimization_mode TEXT NOT NULL CHECK (optimization_mode IN ('fastest', 'fewest_tools')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('cooking', 'done', 'abandoned')),
  step_states TEXT NOT NULL DEFAULT '{}',
  removed_or_substituted TEXT NOT NULL DEFAULT '{}',
  running_timers TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profile(id),
  kind TEXT NOT NULL CHECK (kind IN ('substitute', 'qa', 'scan')),
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_micro_usd INTEGER,
  created_at TEXT NOT NULL
);
`;
