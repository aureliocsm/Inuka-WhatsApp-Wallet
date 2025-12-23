/*
  # Add TZS Token Support
  
  1. Schema Changes
    - Replace usdt_balance with tzs_balance across all tables
    - Add TZS token support to transactions and chama tables
    - Add phone number indexing for faster lookups
    - Add notification tables for transaction and chama events
    - Add loan approval voting table
  
  2. New Tables
    - `notifications` - Store notification events
    - `loan_approvals` - Track loan approval votes from chama members
  
  3. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Update users table: replace usdt_balance with tzs_balance
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'usdt_balance'
  ) THEN
    ALTER TABLE users RENAME COLUMN usdt_balance TO tzs_balance;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'tzs_balance'
  ) THEN
    ALTER TABLE users ADD COLUMN tzs_balance numeric DEFAULT 0;
  END IF;
END $$;

-- Add index on whatsapp_number for faster phone lookups
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_number ON users(whatsapp_number);

-- Update chama_members table: replace usdt_share with tzs_share
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chama_members' AND column_name = 'usdt_share'
  ) THEN
    ALTER TABLE chama_members RENAME COLUMN usdt_share TO tzs_share;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chama_members' AND column_name = 'tzs_share'
  ) THEN
    ALTER TABLE chama_members ADD COLUMN tzs_share numeric DEFAULT 0;
  END IF;
END $$;

-- Update chamas table: replace usdt_pool with tzs_pool
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chamas' AND column_name = 'usdt_pool'
  ) THEN
    ALTER TABLE chamas RENAME COLUMN usdt_pool TO tzs_pool;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chamas' AND column_name = 'tzs_pool'
  ) THEN
    ALTER TABLE chamas ADD COLUMN tzs_pool numeric DEFAULT 0;
  END IF;
END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create loan approvals table for voting system
CREATE TABLE IF NOT EXISTS loan_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES chama_loans(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('approve', 'deny')),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(loan_id, member_id)
);

ALTER TABLE loan_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chama members can view loan approvals"
  ON loan_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chama_loans cl
      JOIN chama_members cm ON cl.chama_id = cm.chama_id
      WHERE cl.id = loan_approvals.loan_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Chama members can vote on loans"
  ON loan_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chama_members
      WHERE id = member_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Add approval tracking to chama_loans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chama_loans' AND column_name = 'approvals_required'
  ) THEN
    ALTER TABLE chama_loans ADD COLUMN approvals_required integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chama_loans' AND column_name = 'approvals_received'
  ) THEN
    ALTER TABLE chama_loans ADD COLUMN approvals_received integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chama_loans' AND column_name = 'denials_received'
  ) THEN
    ALTER TABLE chama_loans ADD COLUMN denials_received integer DEFAULT 0;
  END IF;
END $$;

-- Create FX rates cache table
CREATE TABLE IF NOT EXISTS fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_pair text NOT NULL UNIQUE,
  rate numeric NOT NULL,
  last_updated timestamptz DEFAULT now(),
  source text DEFAULT 'api'
);

ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fx rates"
  ON fx_rates FOR SELECT
  TO authenticated
  USING (true);

-- Insert default FX rates
INSERT INTO fx_rates (currency_pair, rate, source) VALUES
  ('ETH_USD', 2000, 'default'),
  ('USD_TZS', 2500, 'default'),
  ('ETH_TZS', 5000000, 'calculated')
ON CONFLICT (currency_pair) DO NOTHING;

-- Function to update balance helper functions for TZS
CREATE OR REPLACE FUNCTION increment_tzs_balance(user_id_param uuid, amount_param numeric)
RETURNS boolean AS $$
BEGIN
  UPDATE users
  SET tzs_balance = tzs_balance + amount_param
  WHERE id = user_id_param;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_tzs_balance(user_id_param uuid, amount_param numeric)
RETURNS boolean AS $$
DECLARE
  current_balance numeric;
BEGIN
  SELECT tzs_balance INTO current_balance
  FROM users
  WHERE id = user_id_param;
  
  IF current_balance >= amount_param THEN
    UPDATE users
    SET tzs_balance = tzs_balance - amount_param
    WHERE id = user_id_param;
    
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_loan_approvals_loan ON loan_approvals(loan_id);
CREATE INDEX IF NOT EXISTS idx_fx_rates_updated ON fx_rates(last_updated DESC);