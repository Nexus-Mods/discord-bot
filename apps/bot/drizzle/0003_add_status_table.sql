-- Adds a new table for tracking status page items that we have seen. 
CREATE TABLE IF NOT EXISTS status_updates_posted (
  update_id   TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);