
-- Add encryption_key column to conversations (generated per conversation)
ALTER TABLE public.conversations ADD COLUMN encryption_key text NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64');

-- Update the create_conversation_with_participant function to auto-generate key
CREATE OR REPLACE FUNCTION public.create_conversation_with_participant(other_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_conv_id uuid;
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.conversations (encryption_key) VALUES (encode(gen_random_bytes(32), 'base64'))
  RETURNING id INTO new_conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES 
    (new_conv_id, current_user_id),
    (new_conv_id, other_user_id);

  RETURN new_conv_id;
END;
$function$;

-- Update accept_chat_request to also generate key
CREATE OR REPLACE FUNCTION public.accept_chat_request(request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  req record;
  new_conv_id uuid;
BEGIN
  SELECT * INTO req FROM public.chat_requests WHERE id = request_id AND receiver_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not authorized';
  END IF;

  UPDATE public.chat_requests SET status = 'accepted' WHERE id = request_id;

  INSERT INTO public.contacts (user_id, contact_user_id) VALUES (req.receiver_id, req.sender_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.contacts (user_id, contact_user_id) VALUES (req.sender_id, req.receiver_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.conversations (encryption_key) VALUES (encode(gen_random_bytes(32), 'base64'))
  RETURNING id INTO new_conv_id;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (new_conv_id, req.sender_id), (new_conv_id, req.receiver_id);

  RETURN new_conv_id;
END;
$function$;
