/*
  # WhatsApp Crypto Wallet Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `whatsapp_number` (text, unique) - User's WhatsApp phone number
      - `wallet_address` (text, unique) - Ethereum wallet address
      - `encrypted_private_key` (text) - Encrypted private key
      - `encrypted_mnemonic` (text) - Encrypted backup phrase
      - `pin_hash` (text) - Hashed PIN for additional security
      - `is_onboarded` (boolean) - Whether user completed onboarding
      - `created_at` (timestamptz)
      - `last_active` (timestamptz)
    
    - `transactions`
      - `id` (uuid, primary key)
      - `tx_hash` (text, unique) - Blockchain transaction hash
      - `from_user_id` (uuid) - Reference to users table
      - `to_address` (text) - Recipient address
      - `to_user_id` (uuid, nullable) - Reference to users table if internal transfer
      - `amount` (numeric) - Transaction amount in wei
      - `token_address` (text) - Token contract address (null for ETH)
      - `token_symbol` (text) - Token symbol (ETH, USDC, etc)
      - `gas_used` (numeric) - Gas used
      - `gas_price` (numeric) - Gas price in wei
      - `status` (text) - pending, confirmed, failed
      - `network` (text) - sepolia, mainnet, etc
      - `block_number` (bigint)
      - `created_at` (timestamptz)
      - `confirmed_at` (timestamptz)
    
    - `wallet_balances`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Reference to users table
      - `token_address` (text) - Token contract address (null for ETH)
      - `token_symbol` (text) - Token symbol
      - `token_decimals` (int) - Token decimals
      - `balance` (numeric) - Balance in wei/smallest unit
      - `last_updated` (timestamptz)
    
    - `message_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Reference to users table
      - `session_type` (text) - send_money, receive_money, check_balance, etc
      - `session_data` (jsonb) - Current state and collected data
      - `current_step` (text) - Current step in the flow
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `audit_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Reference to users table
      - `action` (text) - Type of action performed
      - `details` (jsonb) - Additional details
      - `ip_address` (text)
      - `user_agent` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
    - Create indexes for performance

  3. Important Notes
    - All private keys and mnemonics are stored encrypted
    - Balances are stored in smallest units (wei for ETH)
    - Session data enables multi-step conversation flows
    - Audit logs track all sensitive operations
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text UNIQUE NOT NULL,
  wallet_address text UNIQUE NOT NULL,
  encrypted_private_key text NOT NULL,
  encrypted_mnemonic text NOT NULL,
  pin_hash text,
  is_onboarded boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  last_active timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash text UNIQUE NOT NULL,
  from_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  to_address text NOT NULL,
  to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  token_address text,
  token_symbol text DEFAULT 'ETH',
  gas_used numeric,
  gas_price numeric,
  status text DEFAULT 'pending',
  network text DEFAULT 'sepolia',
  block_number bigint,
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz
);

-- Create wallet_balances table
CREATE TABLE IF NOT EXISTS wallet_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token_address text,
  token_symbol text DEFAULT 'ETH',
  token_decimals int DEFAULT 18,
  balance numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(user_id, token_address)
);

-- Create message_sessions table
CREATE TABLE IF NOT EXISTS message_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_type text NOT NULL,
  session_data jsonb DEFAULT '{}'::jsonb,
  current_step text,
  expires_at timestamptz DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balances_user ON wallet_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON message_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON message_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for transactions table
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

-- RLS Policies for wallet_balances table
CREATE POLICY "Users can view own balances"
  ON wallet_balances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own balances"
  ON wallet_balances FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own balances"
  ON wallet_balances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for message_sessions table
CREATE POLICY "Users can view own sessions"
  ON message_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own sessions"
  ON message_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for audit_logs table
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);