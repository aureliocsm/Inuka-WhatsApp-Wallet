/*
  # Add PIN Security System

  1. New Tables
    - `user_pins`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `encrypted_pin` (text) - Encrypted PIN hash
      - `failed_attempts` (integer) - Count of failed attempts
      - `locked_until` (timestamptz) - Lockout expiry time
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `pin_required` boolean to users table
    - Add `pin_setup_completed` boolean to users table

  3. Security
    - Enable RLS on user_pins table
    - Add policy for users to read/update their own PIN
    - PINs are encrypted before storage
    - Lockout mechanism after 3 failed attempts (5 minutes)
*/

-- Add PIN columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'pin_required'
  ) THEN
    ALTER TABLE users ADD COLUMN pin_required boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'pin_setup_completed'
  ) THEN
    ALTER TABLE users ADD COLUMN pin_setup_completed boolean DEFAULT false;
  END IF;
END $$;

-- Create user_pins table
CREATE TABLE IF NOT EXISTS user_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  encrypted_pin text NOT NULL,
  failed_attempts integer DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_pins ENABLE ROW LEVEL SECURITY;

-- Policies for user_pins
CREATE POLICY "Users can view their own PIN record"
  ON user_pins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PIN record"
  ON user_pins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PIN record"
  ON user_pins FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_pins_user_id ON user_pins(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_pins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS user_pins_updated_at ON user_pins;
CREATE TRIGGER user_pins_updated_at
  BEFORE UPDATE ON user_pins
  FOR EACH ROW
  EXECUTE FUNCTION update_user_pins_updated_at();