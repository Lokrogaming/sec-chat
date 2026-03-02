
-- Create chat_requests table for public chat requests via profiles
CREATE TABLE public.chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_requests_no_self CHECK (sender_id <> receiver_id),
  CONSTRAINT chat_requests_unique UNIQUE (sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;

-- Sender and receiver can view their requests
CREATE POLICY "Users can view own chat requests"
ON public.chat_requests FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Any authenticated user can send a chat request
CREATE POLICY "Users can send chat requests"
ON public.chat_requests FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

-- Receiver can update (accept/decline) requests sent to them
CREATE POLICY "Receiver can update chat requests"
ON public.chat_requests FOR UPDATE
TO authenticated
USING (receiver_id = auth.uid())
WITH CHECK (receiver_id = auth.uid());

-- Sender can delete (cancel) their own pending requests
CREATE POLICY "Sender can cancel own requests"
ON public.chat_requests FOR DELETE
TO authenticated
USING (sender_id = auth.uid() AND status = 'pending');

-- Function to accept a chat request: creates conversation + contacts
CREATE OR REPLACE FUNCTION public.accept_chat_request(request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  req record;
  new_conv_id uuid;
BEGIN
  SELECT * INTO req FROM public.chat_requests WHERE id = request_id AND receiver_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not authorized';
  END IF;

  -- Update request status
  UPDATE public.chat_requests SET status = 'accepted' WHERE id = request_id;

  -- Add as mutual contacts (ignore if already exist)
  INSERT INTO public.contacts (user_id, contact_user_id) VALUES (req.receiver_id, req.sender_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.contacts (user_id, contact_user_id) VALUES (req.sender_id, req.receiver_id) ON CONFLICT DO NOTHING;

  -- Create conversation
  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO new_conv_id;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (new_conv_id, req.sender_id), (new_conv_id, req.receiver_id);

  RETURN new_conv_id;
END;
$$;
