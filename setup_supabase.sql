-- SQL script to setup database tables for The Meridian
-- Copy-paste this script into the Supabase Dashboard SQL Editor and click Run.

-- 1. Create the news_cache table
CREATE TABLE IF NOT EXISTS news_cache (
    id text PRIMARY KEY,
    title text,
    description text,
    url text,
    image text,
    author text,
    time text,
    category text,
    source text,
    bias_tone text,
    bias_analysis jsonb,
    cache_key text,
    created_at timestamp with time zone DEFAULT now()
);

-- Disable Row Level Security (RLS) to simplify setup for local API requests
ALTER TABLE news_cache DISABLE ROW LEVEL SECURITY;

-- 2. Create the user_location_stats table
CREATE TABLE IF NOT EXISTS user_location_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name text,
    country_code text,
    latitude double precision,
    longitude double precision,
    left_percentage integer,
    right_percentage integer,
    neutral_percentage integer,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE user_location_stats DISABLE ROW LEVEL SECURITY;
