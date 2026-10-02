-- Website form submissions (ZINC forms protocol). The system of record:
-- every submission lands here before any email is attempted.
CREATE TABLE form_submissions (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  form_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  name         TEXT,
  fields       TEXT NOT NULL,          -- JSON of every submitted field
  page_url     TEXT,
  referrer     TEXT,
  tracking     TEXT,                   -- JSON: utm_*, gclid, fbclid, ...
  user_agent   TEXT,
  country      TEXT,
  ip           TEXT,
  status       TEXT NOT NULL DEFAULT 'new',  -- new | contacted | closed | spam
  notified_at  TEXT,
  confirmed_at TEXT,
  note         TEXT
);
CREATE INDEX form_submissions_created ON form_submissions (created_at);
CREATE INDEX form_submissions_ip ON form_submissions (ip, created_at);
