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
