/*
  # Mobile Money & USDT Support

  ## New Tables

  1. `mobile_money_transactions`
    - Tracks all Zeno Pay transactions (on-ramp/off-ramp)
    - `id` (uuid, primary key)
    - `user_id` (uuid, references users)
    - `order_id` (text, unique - Zeno Pay order ID)
    - `transaction_type` (text - 'deposit' or 'withdraw')
    - `token_symbol` (text - 'ETH' or 'USDT')
    - `amount_tzs` (numeric - TZS amount)
    - `amount_crypto` (numeric - crypto amount)
    - `phone_number` (text - M-Pesa number)
    - `payment_channel` (text - 'MPESA-TZ', 'TIGO-TZ', etc)
    - `status` (text - 'pending', 'completed', 'failed')
    - `zeno_reference` (text - Zeno transaction ID)
    - `webhook_data` (jsonb - full webhook payload)
    - `created_at` (timestamptz)
    - `completed_at` (timestamptz)

  2. Updates to `users` table
    - Add USDT balance tracking

  3. Updates to `exchange_rates` table
    - Support USDT conversions

  ## Security
    - Enable RLS on all tables
    - Users can only view their own transactions
*/

-- Mobile Money Transactions Table
CREATE TABLE IF NOT EXISTS mobile_money_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT UNIQUE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw')),
  token_symbol TEXT NOT NULL CHECK (token_symbol IN ('ETH', 'USDT')),
  amount_tzs NUMERIC NOT NULL,
  amount_crypto NUMERIC NOT NULL,
  phone_number TEXT NOT NULL,
  payment_channel TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  zeno_reference TEXT,
  webhook_data JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobile_money_user ON mobile_money_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_money_order ON mobile_money_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_mobile_money_status ON mobile_money_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mobile_money_created ON mobile_money_transactions(created_at DESC);

ALTER TABLE mobile_money_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mobile money transactions"
  ON mobile_money_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mobile money transactions"
  ON mobile_money_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add USDT balance to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'usdt_balance'
  ) THEN
    ALTER TABLE users ADD COLUMN usdt_balance NUMERIC DEFAULT 0;
  END IF;
END $$;

-- Support for USDT in exchange rates
INSERT INTO exchange_rates (currency_pair, rate, last_updated)
VALUES
  ('USDT_USD', 1, NOW()),
  ('USDT_TZS', 2500, NOW())
ON CONFLICT (currency_pair) DO NOTHING;