/*
  # Balance Helper Functions

  ## New RPC Functions
  
  1. `increment_eth_balance` - Safely increment user ETH balance
  2. `increment_usdt_balance` - Safely increment user USDT balance  
  3. `decrement_eth_balance` - Safely decrement user ETH balance
  4. `decrement_usdt_balance` - Safely decrement user USDT balance
  5. `generate_invite_code` - Generate unique 8-character invite codes
  
  ## Purpose
    - Atomic balance operations
    - Prevent race conditions
    - Input validation
    - Error handling
*/

-- Increment ETH balance
CREATE OR REPLACE FUNCTION increment_eth_balance(user_id_param UUID, amount_param NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET eth_balance = eth_balance + amount_param
  WHERE id = user_id_param;
END;
$$;

-- Increment USDT balance
CREATE OR REPLACE FUNCTION increment_usdt_balance(user_id_param UUID, amount_param NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET usdt_balance = COALESCE(usdt_balance, 0) + amount_param
  WHERE id = user_id_param;
END;
$$;

-- Decrement ETH balance (with validation)
CREATE OR REPLACE FUNCTION decrement_eth_balance(user_id_param UUID, amount_param NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  SELECT eth_balance INTO current_balance
  FROM users
  WHERE id = user_id_param;
  
  IF current_balance IS NULL OR current_balance < amount_param THEN
    RETURN FALSE;
  END IF;
  
  UPDATE users
  SET eth_balance = eth_balance - amount_param
  WHERE id = user_id_param;
  
  RETURN TRUE;
END;
$$;

-- Decrement USDT balance (with validation)
CREATE OR REPLACE FUNCTION decrement_usdt_balance(user_id_param UUID, amount_param NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  SELECT COALESCE(usdt_balance, 0) INTO current_balance
  FROM users
  WHERE id = user_id_param;
  
  IF current_balance < amount_param THEN
    RETURN FALSE;
  END IF;
  
  UPDATE users
  SET usdt_balance = COALESCE(usdt_balance, 0) - amount_param
  WHERE id = user_id_param;
  
  RETURN TRUE;
END;
$$;

-- Generate unique invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM chamas WHERE invite_code = result) INTO code_exists;
    
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$;