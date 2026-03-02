
-- Add read_at column to messages
ALTER TABLE public.messages ADD COLUMN read_at timestamp with time zone DEFAULT NULL;

-- Allow participants to update read_at on messages they received
CREATE POLICY "Recipients can mark messages read"
ON public.messages
FOR UPDATE
USING (
  public.is_participant(conversation_id, auth.uid()) AND sender_id != auth.uid()
)
WITH CHECK (
  public.is_participant(conversation_id, auth.uid()) AND sender_id != auth.uid()
);
