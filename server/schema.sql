-- PartnerHub Database Schema (SQLite)

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  youtube_id TEXT,
  pillar TEXT NOT NULL,
  status TEXT NOT NULL,
  tags TEXT,
  journey_stage TEXT,
  focus_keyword TEXT,
  persona TEXT,
  pain_point TEXT,
  problem_solved TEXT,

  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  transcript TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_goals (
  id TEXT PRIMARY KEY, -- Format: YYYY-MM
  target_revenue REAL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL, -- Format: YYYY-MM-DD
  type TEXT NOT NULL, -- 'income' | 'expense'
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS youtube_history (
  date TEXT PRIMARY KEY, -- Format: YYYY-MM-DD
  subscribers INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  videos INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS instagram_history (
  date TEXT PRIMARY KEY, -- Format: YYYY-MM-DD
  followers INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meta_history (
  date TEXT PRIMARY KEY, -- Format: YYYY-MM-DD
  spend REAL DEFAULT 0,
  leads INTEGER DEFAULT 0,
  cpl REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  trigger_keyword TEXT NOT NULL,
  response_message TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value REAL NOT NULL,
  baseline_value REAL DEFAULT 0,
  deadline TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_calendar (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  channel TEXT NOT NULL,
  format TEXT NOT NULL,
  planned_date TEXT NOT NULL,
  status TEXT DEFAULT 'planned',
  notes TEXT,
  tags TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ig_tags (
  name TEXT PRIMARY KEY,
  color TEXT NOT NULL DEFAULT '#E1306C',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS instagram_posts (
  id TEXT PRIMARY KEY,
  caption TEXT,
  media_type TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  posted_at TEXT,
  like_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  saved INTEGER DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  transcript TEXT,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
