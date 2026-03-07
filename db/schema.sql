-- ============================================
-- WHISTLE DATABASE SCHEMA
-- ============================================
-- This file defines the database tables for Whistle.
-- Run this SQL in your Vercel Postgres dashboard to set up the database.
-- ============================================


-- ============================================
-- USERS TABLE
-- ============================================
-- Stores user accounts with name, email, password, and cute ID

CREATE TABLE IF NOT EXISTS users (
    -- Unique identifier for each user (auto-generated)
    id SERIAL PRIMARY KEY,

    -- User's email address (must be unique, used for login)
    email VARCHAR(255) UNIQUE NOT NULL,

    -- User's real name (validated at registration)
    name VARCHAR(255) NOT NULL,

    -- Hashed password (we never store plain text passwords!)
    password_hash VARCHAR(255) NOT NULL,

    -- Session token for keeping users logged in
    -- This is a random string that gets stored in a cookie
    session_token VARCHAR(255),

    -- Unique three-word identifier (e.g., "Steady-Wright-Oak")
    cute_id VARCHAR(100) UNIQUE NOT NULL,

    -- When the account was created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index to make login faster (we search by email a lot)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index to make session lookups faster
CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_token);

-- Index to look up users by cute_id
CREATE INDEX IF NOT EXISTS idx_users_cute_id ON users(cute_id);


-- ============================================
-- TIME ENTRIES TABLE
-- ============================================
-- Stores each clock-in/clock-out session

CREATE TABLE IF NOT EXISTS time_entries (
    -- Unique identifier for each time entry
    id SERIAL PRIMARY KEY,

    -- Which user this entry belongs to
    -- If the user is deleted, their entries are deleted too (CASCADE)
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- When the user clocked in
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,

    -- When the user clocked out (NULL if they're still working)
    end_time TIMESTAMP WITH TIME ZONE,

    -- The timezone when they started (e.g., "America/Toronto")
    -- Used for all time-of-day rule enforcement (5am-9pm, Sunday check, etc.)
    start_timezone VARCHAR(100) NOT NULL,

    -- When this record was created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index to quickly find entries for a specific user
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);

-- Index to quickly find entries by start time (for heatmap and totals)
CREATE INDEX IF NOT EXISTS idx_time_entries_start ON time_entries(start_time);

-- Index to find open sessions (where end_time is NULL)
CREATE INDEX IF NOT EXISTS idx_time_entries_open ON time_entries(user_id, end_time) WHERE end_time IS NULL;


-- ============================================
-- SESSION EDITS TABLE
-- ============================================
-- Tracks every edit to a time entry for audit and rate limiting
-- Users are limited to 3 edits per calendar month

CREATE TABLE IF NOT EXISTS session_edits (
    -- Unique identifier for each edit
    id SERIAL PRIMARY KEY,

    -- Which user made the edit
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Which time entry was edited
    entry_id INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,

    -- When the edit was made
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- The original values before the edit
    old_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    old_end_time TIMESTAMP WITH TIME ZONE,

    -- The new values after the edit
    new_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    new_end_time TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index to quickly count edits per user per month
CREATE INDEX IF NOT EXISTS idx_session_edits_user ON session_edits(user_id, edited_at);


-- ============================================
-- MIGRATION: Add name and cute_id to existing users table
-- ============================================
-- Run this if you have an existing database from before the update.
-- After running, manually set name and cute_id for existing users.
--
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS cute_id VARCHAR(100);
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cute_id ON users(cute_id);
-- UPDATE users SET name = 'Your Name', cute_id = 'Some-Artisan-Word' WHERE name IS NULL;
-- ALTER TABLE users ALTER COLUMN name SET NOT NULL;
-- ALTER TABLE users ALTER COLUMN cute_id SET NOT NULL;
