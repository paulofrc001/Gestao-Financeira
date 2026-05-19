-- SUPABASE DATABASE SCHEMA FOR FINNA AI

-- ENABLE RLS (Row Level Security)
-- 1. FAMILIES
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  creator_id UUID REFERENCES auth.users(id)
);

-- 2. FAMILY MEMBERS (Join table for users and families)
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'partner', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

-- 3. ACCOUNTS
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'checking', 'savings', 'investment', 'credit'
  balance DECIMAL(15, 2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CARDS
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  limit_amount DECIMAL(15, 2),
  closing_day INTEGER,
  due_day INTEGER,
  brand TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CATEGORIES
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT, -- 'income', 'expense'
  is_preset BOOLEAN DEFAULT false
);

-- 6. TRANSACTIONS
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id),
  user_id UUID REFERENCES auth.users(id),
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL, -- 'income', 'expense', 'transfer'
  status TEXT DEFAULT 'completed', -- 'pending', 'completed'
  is_recurring BOOLEAN DEFAULT false,
  recurrence_period TEXT, -- 'daily', 'weekly', 'monthly', 'yearly'
  
  -- EMOTIONAL DATA
  emotion TEXT, -- 'happy', 'sad', 'anxious', 'impulsive', 'regretful', 'satisfied'
  is_impulse BOOLEAN DEFAULT false,
  necessity_level INTEGER CHECK (necessity_level BETWEEN 1 AND 5),
  regret_expected INTEGER CHECK (regret_expected BETWEEN 1 AND 5),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. GOALS
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(15, 2) NOT NULL,
  current_amount DECIMAL(15, 2) DEFAULT 0,
  deadline DATE,
  category TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. AI INSIGHTS
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'alert', 'suggestion', 'pattern'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONFIGURE RLS POLICIES (Simplified example)
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- EXAMPLE POLICY: Users can only see families they are members of
CREATE POLICY member_access ON families
  FOR ALL TO authenticated
  USING (id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

CREATE POLICY member_access ON family_members
  FOR ALL TO authenticated
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- Apply similar patterns to other tables...
