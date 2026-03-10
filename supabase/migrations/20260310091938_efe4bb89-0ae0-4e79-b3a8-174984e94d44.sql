
-- Add public_key column to profiles (only public key stored in DB)
ALTER TABLE public.profiles ADD COLUMN public_key text;

-- Remove encryption_key from conversations (no longer needed)
ALTER TABLE public.conversations DROP COLUMN encryption_key;
