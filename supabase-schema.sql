-- UNIFIED SQL SCHEMA AND MIGRATION FOR FINNA AI
-- Run this in your Supabase SQL Editor to safely create or upgrade your tables and RLS policies.
-- It is designed to be idempotent (completely safe to run multiple times without losing any data).

-- Enable necessary Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. BASE TABLE CREATIONS (IF NOT EXISTENT)
-- ============================================

-- profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  family_name TEXT DEFAULT 'Casa dos Silva',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- families Table
CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- family_members Table
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'partner', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

-- accounts Table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Checking', -- 'Checking', 'Savings', 'Investment', 'Credit'
  balance DECIMAL(15, 2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- cards Table
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  limit_amount DECIMAL(15, 2),
  closing_day INTEGER,
  due_day INTEGER,
  brand TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT, -- 'income', 'expense'
  is_preset BOOLEAN DEFAULT false
);

-- transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'Outros', -- Default parsed string category
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL, -- 'income', 'expense', 'transfer'
  status TEXT DEFAULT 'completed', -- 'pending', 'completed'
  is_recurring BOOLEAN DEFAULT false,
  recurrence_period TEXT, -- 'daily', 'weekly', 'monthly', 'yearly'
  is_subscription BOOLEAN DEFAULT false,
  installments TEXT, -- e.g. '1/10'
  emotion TEXT DEFAULT 'Neutro', -- 'Satisfeito', 'Neutro', 'Preocupado', etc
  source TEXT DEFAULT 'Manual',
  is_impulse BOOLEAN DEFAULT false,
  necessity_level INTEGER,
  regret_expected INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- goals Table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(15, 2) NOT NULL,
  current_amount DECIMAL(15, 2) DEFAULT 0,
  deadline DATE,
  category TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ai_insights Table
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'alert', 'suggestion', 'pattern'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 2. HYBRID SCHEMA MIGRATIONS (ENSURES COLUMN ALIGNMENT)
-- ============================================

-- Ensure profiles is fully compatible
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS family_name TEXT DEFAULT 'Casa dos Silva';

-- Ensure accounts is fully compatible with both schemas
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS color TEXT;

-- Ensure transactions has all required columns for AI imports, emotional metrics, installments, etc.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES cards(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Outros';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS installments TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS emotion TEXT DEFAULT 'Neutro';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Manual';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_impulse BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS necessity_level INTEGER;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS regret_expected INTEGER;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ensure goals is fully compatible
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id) ON DELETE CASCADE;


-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;


-- ============================================
-- 4. POLICIES SETUP (FORCE RESET TO PREVENT NAME OR DEFINITION CONFLICTS)
-- ============================================

-- PROFILES policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- FAMILIES policies
DROP POLICY IF EXISTS "member_access" ON families;
DROP POLICY IF EXISTS "member_access_families" ON families;
CREATE POLICY "member_access_families" ON families
  FOR ALL TO authenticated
  USING (
    creator_id = auth.uid() OR 
    id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

-- FAMILY MEMBERS policies
DROP POLICY IF EXISTS "member_access" ON family_members;
DROP POLICY IF EXISTS "member_access_family_members" ON family_members;
CREATE POLICY "member_access_family_members" ON family_members
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
  );

-- ACCOUNTS policies
DROP POLICY IF EXISTS "Users can manage own accounts" ON accounts;
DROP POLICY IF EXISTS "member_access_accounts" ON accounts;
CREATE POLICY "Users can manage own accounts" ON accounts 
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id OR 
    user_id IS NULL OR 
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

-- TRANSACTIONS policies
DROP POLICY IF EXISTS "Users can manage own transactions" ON transactions;
DROP POLICY IF EXISTS "member_access_transactions" ON transactions;
CREATE POLICY "Users can manage own transactions" ON transactions 
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id OR 
    user_id IS NULL OR 
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

-- GOALS policies
DROP POLICY IF EXISTS "Users can manage own goals" ON goals;
DROP POLICY IF EXISTS "member_access_goals" ON goals;
CREATE POLICY "Users can manage own goals" ON goals
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id OR 
    user_id IS NULL OR 
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

-- CARDS policies
DROP POLICY IF EXISTS "Users can manage own cards" ON cards;
CREATE POLICY "Users can manage own cards" ON cards
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    account_id IN (
      SELECT id FROM accounts 
      WHERE user_id = auth.uid() 
         OR user_id IS NULL 
         OR family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    )
  );

-- NOTIFICATIONS policies
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
CREATE POLICY "Users can manage own notifications" ON notifications
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);
