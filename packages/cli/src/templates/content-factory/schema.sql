-- Content Factory pipeline schema.
-- Tracks every piece from raw source to multi-channel output.

CREATE TABLE IF NOT EXISTS pieces (
  slug          TEXT PRIMARY KEY,          -- e.g. 'q1-launch-recap'
  title         TEXT NOT NULL,
  source_type   TEXT NOT NULL,             -- transcript | webinar | interview | other
  source_uri    TEXT NOT NULL,             -- costate:// URI to the raw file
  stage         TEXT NOT NULL              -- drafting | in-seo | in-distro | shipped | blocked
                  DEFAULT 'drafting',
  draft_uri     TEXT,                      -- costate://<ws>/drafts/<slug>.md
  seo_approved  INTEGER NOT NULL DEFAULT 0,
  seo_notes     TEXT,
  started_at    TEXT NOT NULL,             -- ISO 8601
  shipped_at    TEXT,
  CHECK (stage IN ('drafting','in-seo','in-distro','shipped','blocked')),
  CHECK (source_type IN ('transcript','webinar','interview','other'))
);

CREATE INDEX IF NOT EXISTS idx_pieces_stage ON pieces (stage);

CREATE TABLE IF NOT EXISTS assets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  piece_slug    TEXT NOT NULL REFERENCES pieces(slug) ON DELETE CASCADE,
  channel       TEXT NOT NULL,              -- blog | x | linkedin | newsletter | yt-short
  asset_uri     TEXT NOT NULL,              -- costate:// URI
  word_count    INTEGER,
  created_by    TEXT NOT NULL,              -- agent ID
  created_at    TEXT NOT NULL,
  CHECK (channel IN ('blog','x','linkedin','newsletter','yt-short'))
);

CREATE INDEX IF NOT EXISTS idx_assets_piece    ON assets (piece_slug);
CREATE INDEX IF NOT EXISTS idx_assets_channel  ON assets (channel);

-- View: what's in flight right now
CREATE VIEW IF NOT EXISTS pipeline_status AS
  SELECT stage, COUNT(*) as count
  FROM pieces
  WHERE stage != 'shipped'
  GROUP BY stage;
