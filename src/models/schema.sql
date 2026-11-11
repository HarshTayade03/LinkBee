-- Database Schema for URL Shortener

CREATE TABLE IF NOT EXISTS urls (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(32) NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL
);

-- Index for O(1) B-tree lookup on the hot redirection path
CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);

