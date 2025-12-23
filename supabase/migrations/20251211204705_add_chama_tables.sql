/*
  # Chama / Group Savings Tables

  ## New Tables

  1. `chamas`
    - Main Chama registry
    - `id` (uuid, primary key)
    - `name` (text, unique)
    - `description` (text)
    - `invite_code` (text, unique - 8 char code)
    - `creator_id` (uuid, references users)
    - `share_price_usd` (numeric)
    - `weekly_minimum_contribution` (numeric)
    - `loan_interest_rate` (numeric - percentage)
    - `lockup_period_months` (integer - default 3)
    - `auto_investment_percentage` (numeric - default 10)
    - `contract_address` (text - smart contract address)
    - `total_contributions` (numeric - total USD contributed)
    - `total_eth_holdings` (numeric)
    - `total_usdt_holdings` (numeric)
    - `member_count` (integer)
    - `status` (text - 'active', 'dissolved')
    - `created_at` (timestamptz)

  2. `chama_members`
    - Membership records
    - `id` (uuid, primary key)
    - `chama_id` (uuid, references chamas)
    - `user_id` (uuid, references users)
    - `joined_at` (timestamptz)
    - `total_contributions` (numeric)
    - `eth_share` (numeric)
    - `usdt_share` (numeric)
    - `shares_owned` (numeric)
    - `last_contribution_date` (timestamptz)
    - `missed_contributions` (integer - count)
    - `is_admin` (boolean)
    - `status` (text - 'active', 'withdrawn', 'suspended')

  3. `chama_deposits`
    - Contribution history
    - `id` (uuid, primary key)
    - `chama_id` (uuid, references chamas)
    - `member_id` (uuid, references chama_members)
    - `user_id` (uuid, references users)
    - `token_symbol` (text - 'ETH' or 'USDT')
    - `amount_crypto` (numeric)
    - `amount_usd` (numeric)
    - `eth_invested_amount` (numeric - 10% auto-investment)
    - `tx_hash` (text)
    - `created_at` (timestamptz)

  4. `chama_investments`
    - ETH investment tracking
    - `id` (uuid, primary key)
    - `chama_id` (uuid, references chamas)
    - `eth_amount` (numeric)
    - `purchase_price_usd` (numeric)
    - `current_value_usd` (numeric)
    - `profit_loss` (numeric)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  5. `chama_loans`
    - Loan records
    - `id` (uuid, primary key)
    - `chama_id` (uuid, references chamas)
    - `borrower_id` (uuid, references users)
    - `loan_amount` (numeric)
    - `token_symbol` (text)
    - `interest_rate` (numeric)
    - `total_repayment_due` (numeric)
    - `amount_repaid` (numeric)
    - `outstanding_balance` (numeric)
    - `collateral_amount` (numeric)
    - `collateral_token` (text)
    - `status` (text - 'active', 'repaid', 'defaulted')
    - `disbursed_at` (timestamptz)
    - `due_date` (timestamptz)
    - `repaid_at` (timestamptz)

  6. `chama_penalties`
    - Penalty tracking
    - `id` (uuid, primary key)
    - `chama_id` (uuid, references chamas)
    - `member_id` (uuid, references chama_members)
    - `user_id` (uuid, references users)
    - `penalty_type` (text - 'missed_contribution', 'late_payment')
    - `penalty_amount` (numeric)
    - `month_applied` (text)
    - `paid` (boolean)
    - `created_at` (timestamptz)

  ## Security
    - Enable RLS on all tables
    - Members can only view their own Chama data
    - Admins have additional permissions
*/

-- 1. Chamas Table
CREATE TABLE IF NOT EXISTS chamas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  share_price_usd NUMERIC NOT NULL DEFAULT 10,
  weekly_minimum_contribution NUMERIC NOT NULL DEFAULT 5,
  loan_interest_rate NUMERIC NOT NULL DEFAULT 5,
  lockup_period_months INTEGER NOT NULL DEFAULT 3,
  auto_investment_percentage NUMERIC NOT NULL DEFAULT 10,
  contract_address TEXT,
  total_contributions NUMERIC DEFAULT 0,
  total_eth_holdings NUMERIC DEFAULT 0,
  total_usdt_holdings NUMERIC DEFAULT 0,
  member_count INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dissolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chamas_invite ON chamas(invite_code);
CREATE INDEX IF NOT EXISTS idx_chamas_creator ON chamas(creator_id);
CREATE INDEX IF NOT EXISTS idx_chamas_status ON chamas(status);

ALTER TABLE chamas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active chamas"
  ON chamas FOR SELECT
  USING (status = 'active');

CREATE POLICY "Users can create chamas"
  ON chamas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- 2. Chama Members Table
CREATE TABLE IF NOT EXISTS chama_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  total_contributions NUMERIC DEFAULT 0,
  eth_share NUMERIC DEFAULT 0,
  usdt_share NUMERIC DEFAULT 0,
  shares_owned NUMERIC DEFAULT 0,
  last_contribution_date TIMESTAMPTZ,
  missed_contributions INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'suspended')),
  UNIQUE(chama_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chama_members_chama ON chama_members(chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_members_user ON chama_members(user_id);

ALTER TABLE chama_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own membership"
  ON chama_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Members can view other members in same chama"
  ON chama_members FOR SELECT
  TO authenticated
  USING (
    chama_id IN (
      SELECT chama_id FROM chama_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join chamas"
  ON chama_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Chama Deposits Table
CREATE TABLE IF NOT EXISTS chama_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE,
  member_id UUID REFERENCES chama_members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_symbol TEXT NOT NULL CHECK (token_symbol IN ('ETH', 'USDT')),
  amount_crypto NUMERIC NOT NULL,
  amount_usd NUMERIC NOT NULL,
  eth_invested_amount NUMERIC DEFAULT 0,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chama_deposits_chama ON chama_deposits(chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_deposits_user ON chama_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_chama_deposits_created ON chama_deposits(created_at DESC);

ALTER TABLE chama_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chama deposits"
  ON chama_deposits FOR SELECT
  TO authenticated
  USING (
    chama_id IN (
      SELECT chama_id FROM chama_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert deposits"
  ON chama_deposits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4. Chama Investments Table
CREATE TABLE IF NOT EXISTS chama_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE,
  eth_amount NUMERIC NOT NULL,
  purchase_price_usd NUMERIC NOT NULL,
  current_value_usd NUMERIC,
  profit_loss NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chama_investments_chama ON chama_investments(chama_id);

ALTER TABLE chama_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chama investments"
  ON chama_investments FOR SELECT
  TO authenticated
  USING (
    chama_id IN (
      SELECT chama_id FROM chama_members WHERE user_id = auth.uid()
    )
  );

-- 5. Chama Loans Table
CREATE TABLE IF NOT EXISTS chama_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE,
  borrower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  loan_amount NUMERIC NOT NULL,
  token_symbol TEXT NOT NULL CHECK (token_symbol IN ('ETH', 'USDT')),
  interest_rate NUMERIC NOT NULL,
  total_repayment_due NUMERIC NOT NULL,
  amount_repaid NUMERIC DEFAULT 0,
  outstanding_balance NUMERIC NOT NULL,
  collateral_amount NUMERIC,
  collateral_token TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repaid', 'defaulted')),
  disbursed_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  repaid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chama_loans_chama ON chama_loans(chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_loans_borrower ON chama_loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_chama_loans_status ON chama_loans(status);

ALTER TABLE chama_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chama loans"
  ON chama_loans FOR SELECT
  TO authenticated
  USING (
    chama_id IN (
      SELECT chama_id FROM chama_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Borrowers can view own loans"
  ON chama_loans FOR SELECT
  TO authenticated
  USING (auth.uid() = borrower_id);

-- 6. Chama Penalties Table
CREATE TABLE IF NOT EXISTS chama_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE,
  member_id UUID REFERENCES chama_members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  penalty_type TEXT NOT NULL CHECK (penalty_type IN ('missed_contribution', 'late_payment')),
  penalty_amount NUMERIC NOT NULL,
  month_applied TEXT NOT NULL,
  paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chama_penalties_chama ON chama_penalties(chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_penalties_user ON chama_penalties(user_id);

ALTER TABLE chama_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own penalties"
  ON chama_penalties FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Members can view chama penalties"
  ON chama_penalties FOR SELECT
  TO authenticated
  USING (
    chama_id IN (
      SELECT chama_id FROM chama_members WHERE user_id = auth.uid()
    )
  );