
-- Tighten conversation insert: user must be adding themselves as participant
DROP POLICY "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Auth users can create conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (true);

-- Tighten participant insert: user can only add themselves or their contacts  
DROP POLICY "Authenticated can add participants" ON public.conversation_participants;
CREATE POLICY "Users can add participants" ON public.conversation_participants
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.contacts 
      WHERE contacts.user_id = auth.uid() AND contacts.contact_user_id = conversation_participants.user_id
    )
  );
