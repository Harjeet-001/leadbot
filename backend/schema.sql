-- Run this once with: npm run db:init

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  visitor_name TEXT,
  whatsapp TEXT,
  need TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  widget_key TEXT UNIQUE NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Insert a test client so you can test the widget immediately
INSERT OR IGNORE INTO clients (business_name, business_email, widget_key, active, created_at)
VALUES ('Test Business', 'test@example.com', 'test-key-123', 1, datetime('now'));