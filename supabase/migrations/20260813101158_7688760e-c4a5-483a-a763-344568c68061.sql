ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS cipher text NOT NULL DEFAULT 'aes-gcm';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_key_alg text;

CREATE POLICY "Participants can update conversation cipher"
ON public.conversations FOR UPDATE
TO authenticated
USING (public.is_participant(id, auth.uid()))
WITH CHECK (public.is_participant(id, auth.uid()));