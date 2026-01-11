-- ============================================
-- WHISTLE DATABASE SCHEMA
-- ============================================
-- This file defines the database tables for Whistle.
-- Run this SQL in your Vercel Postgres dashboard to set up the database.
-- ============================================


-- ============================================
-- USERS TABLE
-- ============================================
-- Stores user accounts (email and hashed password)

CREATE TABLE users (
    -- Unique identifier for each user (auto-generated)
    id SERIAL PRIMARY KEY,

    -- User's email address (must be unique, used for login)
    email VARCHAR(255) UNIQUE NOT NULL,

    -- Hashed password (we never store plain text passwords!)
    password_hash VARCHAR(255) NOT NULL,

    -- Session token for keeping users logged in
    -- This is a random string that gets stored in a cookie
    session_token VARCHAR(255),

    -- When the account was created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index to make login faster (we search by email a lot)
CREATE INDEX idx_users_email ON users(email);

-- Index to make session lookups faster
CREATE INDEX idx_users_session ON users(session_token);


-- ============================================
-- TIME ENTRIES TABLE
-- ============================================
-- Stores each clock-in/clock-out session

CREATE TABLE time_entries (
    -- Unique identifier for each time entry
    id SERIAL PRIMARY KEY,

    -- Which user this entry belongs to
    -- If the user is deleted, their entries are deleted too (CASCADE)
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- When the user clocked in
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,

    -- When the user clocked out (NULL if they're still working)
    end_time TIMESTAMP WITH TIME ZONE,

    -- The timezone when they started (e.g., "America/New_York")
    -- We use this to make sure end_time uses the same timezone
    start_timezone VARCHAR(100) NOT NULL,

    -- When this record was created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index to quickly find entries for a specific user
CREATE INDEX idx_time_entries_user ON time_entries(user_id);

-- Index to quickly find entries by start time (for heatmap and totals)
CREATE INDEX idx_time_entries_start ON time_entries(start_time);

-- Index to find open sessions (where end_time is NULL)
CREATE INDEX idx_time_entries_open ON time_entries(user_id, end_time) WHERE end_time IS NULL;
