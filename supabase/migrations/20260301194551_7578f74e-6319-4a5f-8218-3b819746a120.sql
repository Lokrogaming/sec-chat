-- Drop and recreate conversation insert policy with explicit auth check
DROP POLICY IF EXISTS "Auth users can create conversations" ON public.conversations;

CREATE POLICY "Auth users can create conversations" 
ON public.conversations 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also notify PostgREST to reload
NOTIFY pgrst, 'reload schema';