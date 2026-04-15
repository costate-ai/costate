-- Support Triage workspace schema.
-- Run once at workspace setup: `costate_sql` with this file's contents.

CREATE TABLE IF NOT EXISTS tickets (
  id              TEXT PRIMARY KEY,
  received_at     TEXT NOT NULL,          -- ISO 8601
  customer_email  TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  category        TEXT,                   -- billing | tech | product | NULL (unclassified)
  status          TEXT NOT NULL           -- new | triaged | working | answered | escalated
                    DEFAULT 'new',
  assigned_agent  TEXT,                   -- @cs/billing | @cs/tech | NULL
  response        TEXT,                   -- specialist's reply
  resolved_at     TEXT,                   -- ISO 8601 when answered
  CHECK (status IN ('new','triaged','working','answered','escalated')),
  CHECK (category IS NULL OR category IN ('billing','tech','product'))
);

CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets (category);

-- FTS5 over subject + body so @cs/triage can find similar past tickets.
CREATE VIRTUAL TABLE IF NOT EXISTS tickets_fts USING fts5(
  subject, body, content='tickets', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS tickets_fts_insert AFTER INSERT ON tickets BEGIN
  INSERT INTO tickets_fts(rowid, subject, body) VALUES (new.rowid, new.subject, new.body);
END;

CREATE TRIGGER IF NOT EXISTS tickets_fts_update AFTER UPDATE OF subject, body ON tickets BEGIN
  INSERT INTO tickets_fts(tickets_fts, rowid, subject, body)
    VALUES('delete', old.rowid, old.subject, old.body);
  INSERT INTO tickets_fts(rowid, subject, body) VALUES (new.rowid, new.subject, new.body);
END;

CREATE TRIGGER IF NOT EXISTS tickets_fts_delete AFTER DELETE ON tickets BEGIN
  INSERT INTO tickets_fts(tickets_fts, rowid, subject, body)
    VALUES('delete', old.rowid, old.subject, old.body);
END;
