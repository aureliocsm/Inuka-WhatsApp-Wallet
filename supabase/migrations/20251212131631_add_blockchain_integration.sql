/*
  # Add Blockchain Integration Fields

  1. Changes to Tables
    - `chamas`
      - Add `contract_address` (text) - Smart contract address for the chama
      - Add `creation_tx_hash` (text) - Transaction hash from chama creation
      - Add `creation_explorer_link` (text) - Block explorer link for creation tx
    
    - `chama_contributions` (new table)
      - Track all contributions with on-chain transaction details
      - Links to chama_id and user_id
      - Stores tx_hash and explorer_link
    
    - `chama_loans`
      - Add `tx_hash` (text) - Transaction hash for loan request
      - Add `explorer_link` (text) - Block explorer link
      - Add `on_chain_loan_id` (integer) - Loan ID from smart contract
      - Add `vote_tx_hashes` (jsonb) - Map of voter address to tx hash
      - Add `disbursement_tx_hash` (text) - Transaction hash for disbursement
      - Add `repayment_tx_hashes` (jsonb) - Array of repayment tx hashes

  2. Security
    - Maintain existing RLS policies
*/

-- Add blockchain fields to chamas table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chamas' AND column_name = 'contract_address'
  ) THEN
    ALTER TABLE chamas ADD COLUMN contract_address TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chamas' AND column_name = 'creation_tx_hash'
  ) THEN
    ALTER TABLE chamas ADD COLUMN creation_tx_hash TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chamas' AND column_name = 'creation_explorer_link'
  ) THEN
    ALTER TABLE chamas ADD COLUMN creation_explorer_link TEXT;
  END IF;
END $$;

-- Create chama_contributions table if not exists
CREATE TABLE IF NOT EXISTS chama_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id UUID REFERENCES chama_members(id) ON DELETE SET NULL,
  token_symbol TEXT NOT NULL,
  amount_crypto DECIMAL(18, 8) NOT NULL,
  amount_usd DECIMAL(18, 6) NOT NULL,
  tx_hash TEXT,
  explorer_link TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  CONSTRAINT valid_token CHECK (token_symbol IN ('ETH', 'TZS'))
);

-- Enable RLS
ALTER TABLE chama_contributions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chama_contributions
CREATE POLICY "Users can view own contributions"
  ON chama_contributions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Chama members can view all contributions"
  ON chama_contributions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chama_members
      WHERE chama_members.chama_id = chama_contributions.chama_id
      AND chama_members.user_id = auth.uid()
      AND chama_members.status = 'active'
    )
  );

CREATE POLICY "Users can insert own contributions"
  ON chama_contributions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contributions"
  ON chama_contributions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add blockchain fields to chama_loans table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chama_loans' AND column_name = 'tx_hash'
  ) THEN
    ALTER TABLE chama_loans ADD COLUMN tx_hash TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chama_loans' AND column_name = 'explorer_link'
  ) THEN
    ALTER TABLE chama_loans ADD COLUMN explorer_link TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chama_loans' AND column_name = 'on_chain_loan_id'
  ) THEN
    ALTER TABLE chama_loans ADD COLUMN on_chain_loan_id INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chama_loans' AND column_name = 'vote_tx_hashes'
  ) THEN
    ALTER TABLE chama_loans ADD COLUMN vote_tx_hashes JSONB DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chama_loans' AND column_name = 'disbursement_tx_hash'
  ) THEN
    ALTER TABLE chama_loans ADD COLUMN disbursement_tx_hash TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chama_loans' AND column_name = 'repayment_tx_hashes'
  ) THEN
    ALTER TABLE chama_loans ADD COLUMN repayment_tx_hashes JSONB DEFAULT '[]';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chamas_contract_address ON chamas(contract_address);
CREATE INDEX IF NOT EXISTS idx_chama_contributions_chama_id ON chama_contributions(chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_contributions_user_id ON chama_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_chama_contributions_tx_hash ON chama_contributions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_chama_loans_on_chain_loan_id ON chama_loans(on_chain_loan_id);
