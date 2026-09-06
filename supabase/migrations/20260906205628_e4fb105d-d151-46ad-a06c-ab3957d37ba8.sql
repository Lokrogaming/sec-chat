CREATE TABLE public.emojis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcode text NOT NULL UNIQUE,
  image_data text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emojis TO authenticated;
GRANT ALL ON public.emojis TO service_role;

ALTER TABLE public.emojis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in users can view emojis"
ON public.emojis FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage emojis"
ON public.emojis FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_emojis_updated_at
BEFORE UPDATE ON public.emojis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();