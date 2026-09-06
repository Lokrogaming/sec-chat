CREATE TABLE public.chat_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

GRANT SELECT, INSERT, DELETE ON public.chat_images TO authenticated;
GRANT ALL ON public.chat_images TO service_role;

ALTER TABLE public.chat_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view chat images"
ON public.chat_images FOR SELECT TO authenticated
USING (public.is_participant(conversation_id, auth.uid()));

CREATE POLICY "Participants can add chat images"
ON public.chat_images FOR INSERT TO authenticated
WITH CHECK (uploader_id = auth.uid() AND public.is_participant(conversation_id, auth.uid()));

CREATE POLICY "Uploader can delete own chat images"
ON public.chat_images FOR DELETE TO authenticated
USING (uploader_id = auth.uid());

CREATE POLICY "Participants can read chat image files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-images'
  AND public.is_participant(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Participants can upload chat image files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND public.is_participant(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Participants can delete chat image files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-images'
  AND public.is_participant(((storage.foldername(name))[1])::uuid, auth.uid())
);