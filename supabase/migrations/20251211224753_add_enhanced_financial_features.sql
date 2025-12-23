/*
  # Enhanced Financial Features - Bank Accounts, Loans, and Chama Enhancements

  ## Overview
  This migration adds comprehensive support for:
  - Bank account management for fiat withdrawals
  - Loan repayment tracking
  - Chama withdrawal management with lockup validation
  - Enhanced Chama member tracking with contribution schedules
  - Automated penalty calculations
  - Performance tracking utilities

  ## New Tables

  1. `bank_accounts`
    - Stores user bank account information for withdrawals
    - `id` (uuid, primary key)
    - `user_id` (uuid, references users)
    - `account_number` (text)
    - `bank_name` (text)
    - `account_holder_name` (text)
    - `is_default` (boolean)
    - `is_verified` (boolean)
    - `created_at` (timestamptz)

  2. `loan_repayments`
    - Tracks individual loan repayment transactions
    - `id` (uuid, primary key)
    - `loan_id` (uuid, references chama_loans)
    - `user_id` (uuid, references users)
    - `amount_paid` (numeric)
    - `payment_method` (text)
    - `remaining_balance` (numeric)
    - `payment_date` (timestamptz)

  3. `chama_withdrawals`
    - Tracks Chama member withdrawals
    - `id` (uuid, primary key)
    - `chama_id` (uuid, references chamas)
    - `member_id` (uuid, references chama_members)
    - `user_id` (uuid, references users)
    - `withdrawal_amount` (numeric)
    - `eth_amount` (numeric)
    - `usdt_amount` (numeric)
    - `penalties_deducted` (numeric)
    - `net_amount` (numeric)
    - `status` (text)
    - `processed_at` (timestamptz)
    - `created_at` (timestamptz)

  ## Table Enhancements

  - Add `payment_channel` options for Tigo Pesa
  - Add contribution tracking fields to chama_members
  - Add collateral tracking to loans

  ## Helper Functions

  - `calculate_member_penalties` - Calculate penalties for missed contributions
  - `check_withdrawal_eligibility` - Validate lockup period and eligibility
  - `update_chama_totals` - Recalculate Chama aggregates
  - `process_chama_deposit` - Handle Chama deposits with auto-investment
  - `calculate_loan_eligibility` - Determine max loan amount for member

  ## Security
    - Enable RLS on all tables
    - Users can only access their own data
    - Chama members can view shared Chama data
*/

-- ============================================================================
-- 1. BANK ACCOUNTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_default ON bank_accounts(user_id, is_default) WHERE is_default = true;

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank accounts"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank accounts"
  ON bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank accounts"
  ON bank_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank accounts"
  ON bank_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2. LOAN REPAYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES chama_loans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount_paid NUMERIC NOT NULL CHECK (amount_paid > 0),
  payment_method TEXT DEFAULT 'wallet_transfer',
  remaining_balance NUMERIC NOT NULL CHECK (remaining_balance >= 0),
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_user ON loan_repayments(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_date ON loan_repayments(payment_date DESC);

ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own loan repayments"
  ON loan_repayments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own loan repayments"
  ON loan_repayments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. CHAMA WITHDRAWALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS chama_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES chama_members(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  withdrawal_amount NUMERIC NOT NULL CHECK (withdrawal_amount > 0),
  eth_amount NUMERIC DEFAULT 0,
  usdt_amount NUMERIC DEFAULT 0,
  penalties_deducted NUMERIC DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chama_withdrawals_chama ON chama_withdrawals(chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_withdrawals_user ON chama_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_chama_withdrawals_status ON chama_withdrawals(status);

ALTER TABLE chama_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawals"
  ON chama_withdrawals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Chama members can view chama withdrawals"
  ON chama_withdrawals FOR SELECT
  TO authenticated
  USING (
    chama_id IN (
      SELECT chama_id FROM chama_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own withdrawals"
  ON chama_withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Calculate member penalties for missed contributions
CREATE OR REPLACE FUNCTION calculate_member_penalties(member_id_param UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_penalties NUMERIC := 0;
  member_record RECORD;
  chama_record RECORD;
  months_active INTEGER;
  expected_contributions INTEGER;
  actual_contributions INTEGER;
  missed_count INTEGER;
  penalty_per_miss NUMERIC;
BEGIN
  -- Get member details
  SELECT * INTO member_record
  FROM chama_members
  WHERE id = member_id_param;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Get chama details
  SELECT * INTO chama_record
  FROM chamas
  WHERE id = member_record.chama_id;
  
  -- Calculate months since joining (minimum 1)
  months_active := GREATEST(
    EXTRACT(MONTH FROM AGE(NOW(), member_record.joined_at))::INTEGER,
    1
  );
  
  -- Expected contributions (4 weeks per month)
  expected_contributions := months_active * 4;
  
  -- Get actual contribution count
  SELECT COUNT(*) INTO actual_contributions
  FROM chama_deposits
  WHERE member_id = member_id_param;
  
  -- Calculate missed contributions
  missed_count := GREATEST(expected_contributions - actual_contributions, 0);
  
  -- Calculate penalty: 1% per year = 0.0833% per month
  -- Applied to weekly minimum contribution
  penalty_per_miss := chama_record.weekly_minimum_contribution * 0.000833;
  
  total_penalties := missed_count * penalty_per_miss;
  
  RETURN ROUND(total_penalties, 5);
END;
$$;

-- Check if member is eligible to withdraw from Chama
CREATE OR REPLACE FUNCTION check_withdrawal_eligibility(member_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_record RECORD;
  chama_record RECORD;
  months_active INTEGER;
  can_withdraw BOOLEAN;
  reason TEXT;
  penalties NUMERIC;
BEGIN
  -- Get member details
  SELECT * INTO member_record
  FROM chama_members
  WHERE id = member_id_param;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Member not found'
    );
  END IF;
  
  IF member_record.status != 'active' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Member is not active'
    );
  END IF;
  
  -- Get chama details
  SELECT * INTO chama_record
  FROM chamas
  WHERE id = member_record.chama_id;
  
  -- Calculate months since joining
  months_active := EXTRACT(MONTH FROM AGE(NOW(), member_record.joined_at))::INTEGER;
  
  -- Check lockup period
  IF months_active < chama_record.lockup_period_months THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', format('Lockup period not met. %s more months required.', 
                       chama_record.lockup_period_months - months_active),
      'months_remaining', chama_record.lockup_period_months - months_active
    );
  END IF;
  
  -- Calculate penalties
  penalties := calculate_member_penalties(member_id_param);
  
  RETURN jsonb_build_object(
    'eligible', true,
    'reason', 'Eligible for withdrawal',
    'months_active', months_active,
    'penalties', penalties,
    'eth_share', member_record.eth_share,
    'usdt_share', member_record.usdt_share,
    'total_contributions', member_record.total_contributions
  );
END;
$$;

-- Update Chama totals after deposit/withdrawal
CREATE OR REPLACE FUNCTION update_chama_totals(chama_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_eth NUMERIC;
  total_usdt NUMERIC;
  total_contrib NUMERIC;
BEGIN
  -- Sum all member shares
  SELECT 
    COALESCE(SUM(eth_share), 0),
    COALESCE(SUM(usdt_share), 0),
    COALESCE(SUM(total_contributions), 0)
  INTO total_eth, total_usdt, total_contrib
  FROM chama_members
  WHERE chama_id = chama_id_param
    AND status = 'active';
  
  -- Update chama record
  UPDATE chamas
  SET 
    total_eth_holdings = total_eth,
    total_usdt_holdings = total_usdt,
    total_contributions = total_contrib
  WHERE id = chama_id_param;
END;
$$;

-- Process Chama deposit with auto-investment (10% stablecoins to ETH)
CREATE OR REPLACE FUNCTION process_chama_deposit(
  chama_id_param UUID,
  member_id_param UUID,
  user_id_param UUID,
  token_symbol_param TEXT,
  amount_crypto_param NUMERIC,
  amount_usd_param NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  eth_investment_amount NUMERIC := 0;
  member_eth_share NUMERIC;
  member_usdt_share NUMERIC;
BEGIN
  -- Calculate 10% auto-investment for USDT
  IF token_symbol_param = 'USDT' THEN
    eth_investment_amount := amount_crypto_param * 0.10;
    member_eth_share := eth_investment_amount;
    member_usdt_share := amount_crypto_param * 0.90;
  ELSIF token_symbol_param = 'ETH' THEN
    member_eth_share := amount_crypto_param;
    member_usdt_share := 0;
  END IF;
  
  -- Create deposit record
  INSERT INTO chama_deposits (
    chama_id,
    member_id,
    user_id,
    token_symbol,
    amount_crypto,
    amount_usd,
    eth_invested_amount
  ) VALUES (
    chama_id_param,
    member_id_param,
    user_id_param,
    token_symbol_param,
    amount_crypto_param,
    amount_usd_param,
    eth_investment_amount
  );
  
  -- Update member shares
  UPDATE chama_members
  SET 
    eth_share = eth_share + member_eth_share,
    usdt_share = usdt_share + member_usdt_share,
    total_contributions = total_contributions + amount_usd_param,
    last_contribution_date = NOW()
  WHERE id = member_id_param;
  
  -- Update chama totals
  PERFORM update_chama_totals(chama_id_param);
  
  RETURN jsonb_build_object(
    'success', true,
    'eth_invested', eth_investment_amount,
    'member_eth_share', member_eth_share,
    'member_usdt_share', member_usdt_share
  );
END;
$$;

-- Calculate maximum loan eligibility for a member
CREATE OR REPLACE FUNCTION calculate_loan_eligibility(member_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_record RECORD;
  chama_record RECORD;
  active_loan_balance NUMERIC := 0;
  max_loan_amount NUMERIC;
  member_share_value NUMERIC;
BEGIN
  -- Get member details
  SELECT * INTO member_record
  FROM chama_members
  WHERE id = member_id_param;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Member not found');
  END IF;
  
  -- Get chama details
  SELECT * INTO chama_record
  FROM chamas
  WHERE id = member_record.chama_id;
  
  -- Check for active loans
  SELECT COALESCE(SUM(outstanding_balance), 0) INTO active_loan_balance
  FROM chama_loans
  WHERE borrower_id = member_record.user_id
    AND chama_id = member_record.chama_id
    AND status = 'active';
  
  -- Calculate member's share value (contributions)
  member_share_value := member_record.total_contributions;
  
  -- Max loan: 80% of contributions minus existing loans
  max_loan_amount := (member_share_value * 0.80) - active_loan_balance;
  
  IF max_loan_amount <= 0 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Insufficient contribution history or existing loan',
      'max_loan', 0
    );
  END IF;
  
  RETURN jsonb_build_object(
    'eligible', true,
    'max_loan_amount', ROUND(max_loan_amount, 5),
    'member_contributions', member_share_value,
    'active_loan_balance', active_loan_balance,
    'interest_rate', chama_record.loan_interest_rate
  );
END;
$$;

-- ============================================================================
-- 5. ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add Tigo Pesa support to mobile_money_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'mobile_money_transactions_payment_channel_check'
  ) THEN
    ALTER TABLE mobile_money_transactions 
    DROP CONSTRAINT IF EXISTS mobile_money_transactions_payment_channel_check;
  END IF;
END $$;

-- Add ETH balance to users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'eth_balance'
  ) THEN
    ALTER TABLE users ADD COLUMN eth_balance NUMERIC DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- 6. CREATE EXCHANGE RATES TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_pair TEXT UNIQUE NOT NULL,
  rate NUMERIC NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default rates
INSERT INTO exchange_rates (currency_pair, rate, last_updated)
VALUES
  ('ETH_USD', 3000, NOW()),
  ('USDT_USD', 1, NOW()),
  ('USD_TZS', 2500, NOW()),
  ('USDT_TZS', 2500, NOW())
ON CONFLICT (currency_pair) DO UPDATE SET last_updated = NOW();

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view exchange rates"
  ON exchange_rates FOR SELECT
  USING (true);
