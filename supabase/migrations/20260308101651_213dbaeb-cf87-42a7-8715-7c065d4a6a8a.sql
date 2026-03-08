
CREATE TABLE public.video_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_reports ENABLE ROW LEVEL SECURITY;

-- Users can report videos
CREATE POLICY "Users can report videos" ON public.video_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Users can view own reports
CREATE POLICY "Users can view own reports" ON public.video_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- Admins can manage all reports
CREATE POLICY "Admins can manage reports" ON public.video_reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
