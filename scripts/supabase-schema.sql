-- BountyPilot Schema for Supabase
-- Run this in Supabase SQL Editor before importing data
-- This creates all tables with proper types and constraints

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'pending',
    trial_ends_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    full_name TEXT,
    creator_name TEXT,
    main_platforms TEXT,
    content_formats TEXT,
    niche TEXT,
    skill_level TEXT,
    preferred_bounty_types TEXT,
    minimum_reward REAL,
    weekly_content_capacity INTEGER,
    target_monthly_earnings REAL,
    creator_strengths TEXT,
    creator_weaknesses TEXT,
    portfolio_links TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bounties table
CREATE TABLE IF NOT EXISTS bounties (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    url TEXT NOT NULL,
    title TEXT,
    platform TEXT,
    project_name TEXT,
    reward_amount TEXT,
    reward_currency TEXT,
    prize_rank TEXT,
    deadline TEXT,
    content_format TEXT,
    submission_requirements TEXT,
    deliverables TEXT,
    submission_link TEXT,
    eligibility_rules TEXT,
    important_notes TEXT,
    opportunity_score INTEGER,
    score_explanation TEXT,
    confidence_score INTEGER,
    opportunity_type TEXT DEFAULT 'Bounty',
    status TEXT NOT NULL DEFAULT 'discovered',
    hours_saved INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bounty reports table
CREATE TABLE IF NOT EXISTS bounty_reports (
    id SERIAL PRIMARY KEY,
    bounty_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by INTEGER,
    resolution TEXT
);

-- Research briefs table
CREATE TABLE IF NOT EXISTS research_briefs (
    id SERIAL PRIMARY KEY,
    bounty_id INTEGER NOT NULL,
    summary TEXT,
    content_angles TEXT,
    key_points TEXT,
    target_audience TEXT,
    competitor_analysis TEXT,
    full_content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Production plans table
CREATE TABLE IF NOT EXISTS production_plans (
    id SERIAL PRIMARY KEY,
    bounty_id INTEGER NOT NULL,
    script_outline TEXT,
    shot_list TEXT,
    caption_draft TEXT,
    submission_checklist TEXT,
    estimated_hours REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    bounty_id INTEGER NOT NULL,
    submitted_at TIMESTAMPTZ,
    submission_url TEXT,
    result TEXT DEFAULT 'pending',
    reward_received REAL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Earnings table
CREATE TABLE IF NOT EXISTS earnings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    bounty_id INTEGER,
    platform TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USDC',
    received_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_bounties_user_id ON bounties(user_id);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
CREATE INDEX IF NOT EXISTS idx_bounty_reports_bounty_id ON bounty_reports(bounty_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_bounty_id ON submissions(bounty_id);
CREATE INDEX IF NOT EXISTS idx_earnings_user_id ON earnings(user_id);

-- Set up Row Level Security (RLS) for Supabase (recommended but optional)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Schema setup complete!
