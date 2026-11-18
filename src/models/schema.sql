-- Database Schema for LinkBee URL Shortener

-- Users Table (Email & Password + Username + Verification)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token VARCHAR(128) NULL,
    verification_expires_at TIMESTAMPTZ NULL,
    avatar_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for username and email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);

-- URLs Table
CREATE TABLE IF NOT EXISTS urls (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL REFERENCES users(id) ON DELETE CASCADE,
    short_code VARCHAR(32) NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL
);

-- Index for O(1) B-tree lookup on the hot redirection path
CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id);

-- Click Analytics Table
CREATE TABLE IF NOT EXISTS clicks (
    id BIGSERIAL PRIMARY KEY,
    url_id BIGINT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    referrer VARCHAR(512) NULL,
    user_agent VARCHAR(512) NULL
);

-- Composite index for fast URL-filtered, time-ordered analytics queries
CREATE INDEX IF NOT EXISTS idx_clicks_url_id_clicked_at ON clicks(url_id, clicked_at DESC);

-- Public abuse reports. Reporter IP addresses are intentionally not persisted.
CREATE TABLE IF NOT EXISTS link_reports (
    id BIGSERIAL PRIMARY KEY,
    reported_url TEXT NOT NULL,
    reason VARCHAR(32) NOT NULL CHECK (reason IN ('phishing', 'malware', 'spam', 'illegal-content', 'other')),
    details VARCHAR(1000) NULL,
    reporter_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_link_reports_status_created_at ON link_reports(status, created_at DESC);
