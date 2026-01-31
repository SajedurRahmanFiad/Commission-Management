-- Add avatar column to profiles to store avatar URLs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar text;

COMMENT ON COLUMN public.profiles.avatar IS 'URL or path to user avatar image';
