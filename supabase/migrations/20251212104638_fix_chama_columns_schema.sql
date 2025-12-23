/*
  # Fix Chama Schema - Add Missing Columns

  ## Changes
  
  This migration adds missing columns to support multi-currency (ETH and TZS) tracking in chamas:
  
  ### Chamas Table Updates
  - `eth_pool` (numeric) - Total ETH contributed to the chama pool
  - `tzs_pool` (numeric) - Total TZS contributed to the chama pool
  
  ### Chama Members Table Updates
  - `eth_share` (numeric) - Member's ETH contribution to the chama
  - `tzs_share` (numeric) - Member's TZS contribution to the chama
  
  ## Rationale
  
  These columns are essential for:
  1. Tracking multi-currency contributions in chamas
  2. Calculating member shares for loan eligibility
  3. Supporting both ETH and TZS token deposits
  4. Providing accurate balance reporting per currency
  
  All columns default to 0 to ensure data integrity for existing records.
*/

-- Add currency pool columns to chamas table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chamas' AND column_name = 'eth_pool'
  ) THEN
    ALTER TABLE chamas ADD COLUMN eth_pool NUMERIC DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chamas' AND column_name = 'tzs_pool'
  ) THEN
    ALTER TABLE chamas ADD COLUMN tzs_pool NUMERIC DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add currency share columns to chama_members table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chama_members' AND column_name = 'eth_share'
  ) THEN
    ALTER TABLE chama_members ADD COLUMN eth_share NUMERIC DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chama_members' AND column_name = 'tzs_share'
  ) THEN
    ALTER TABLE chama_members ADD COLUMN tzs_share NUMERIC DEFAULT 0 NOT NULL;
  END IF;
END $$;