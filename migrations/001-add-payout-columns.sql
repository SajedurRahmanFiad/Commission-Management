-- Add payout account fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bkash_number text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nagad_number text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rocket_number text;

-- Optionally, set a default empty string or NULL as appropriate. For audit, add comment:
COMMENT ON COLUMN public.profiles.bkash_number IS 'Agent bKash payout number';
COMMENT ON COLUMN public.profiles.nagad_number IS 'Agent Nagad payout number';
COMMENT ON COLUMN public.profiles.rocket_number IS 'Agent Rocket payout number';
