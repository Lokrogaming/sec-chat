
-- Drop and recreate all RLS policies as PERMISSIVE (default)

-- conversations
DROP POLICY IF EXISTS "Auth users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;

CREATE POLICY "Auth users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT TO authenticated USING (is_participant(id, auth.uid()));

-- conversation_participants
DROP POLICY IF EXISTS "Participants can view participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;

CREATE POLICY "Participants can view participants" ON public.conversation_participants FOR SELECT TO authenticated USING (is_participant(conversation_id, auth.uid()));
CREATE POLICY "Users can add participants" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) OR (EXISTS (SELECT 1 FROM contacts WHERE contacts.user_id = auth.uid() AND contacts.contact_user_id = conversation_participants.user_id)));

-- messages
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;

CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK ((sender_id = auth.uid()) AND is_participant(conversation_id, auth.uid()));
CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT TO authenticated USING (is_participant(conversation_id, auth.uid()));

-- contacts
DROP POLICY IF EXISTS "Users can view own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON public.contacts;

CREATE POLICY "Users can view own contacts" ON public.contacts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own contacts" ON public.contacts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- profiles
DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view any profile" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
