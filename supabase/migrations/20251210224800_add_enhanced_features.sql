/*
  # Enhanced Wallet Features

  ## Changes
  
  1. Users Table Updates
    - Add `name` field for user's name/nickname
    - Add `preferred_currency` field (ETH, USD, TZS)
    
  2. New Tables
    - `exchange_rates` - Cache for currency exchange rates
    - `wallet_contacts` - Phone number to wallet address mapping
    - `pending_notifications` - Queue for incoming transaction notifications
    
  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for user data access
*/

-- Add new columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    ALTER TABLE users ADD COLUMN name TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferred_currency'
  ) THEN
    ALTER TABLE users ADD COLUMN preferred_currency TEXT DEFAULT 'ETH' CHECK (preferred_currency IN ('ETH', 'USD', 'TZS'));
  END IF;
END $$;

-- Create exchange_rates table for caching currency conversion rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_pair TEXT UNIQUE NOT NULL,
  rate NUMERIC NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exchange rates are publicly readable"
  ON exchange_rates FOR SELECT
  TO public
  USING (true);

-- Create wallet_contacts table for phone-to-address mapping
CREATE TABLE IF NOT EXISTS wallet_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_phone)
);

CREATE INDEX IF NOT EXISTS idx_wallet_contacts_user ON wallet_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_contacts_phone ON wallet_contacts(contact_phone);

ALTER TABLE wallet_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts"
  ON wallet_contacts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
  ON wallet_contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON wallet_contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
  ON wallet_contacts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create pending_notifications table for incoming transaction notifications
CREATE TABLE IF NOT EXISTS pending_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('incoming_transfer', 'transaction_confirmed')),
  data JSONB DEFAULT '{}',
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_notifications_user ON pending_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_notifications_sent ON pending_notifications(sent);

ALTER TABLE pending_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON pending_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exchange_rates_updated ON exchange_rates(last_updated);

-- Insert initial exchange rate placeholders (will be updated by the app)
INSERT INTO exchange_rates (currency_pair, rate, last_updated)
VALUES 
  ('ETH_USD', 0, NOW()),
  ('USD_TZS', 0, NOW())
ON CONFLICT (currency_pair) DO NOTHING;
