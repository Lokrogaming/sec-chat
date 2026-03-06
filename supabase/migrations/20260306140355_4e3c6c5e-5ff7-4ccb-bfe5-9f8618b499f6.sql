
-- Videos table
CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view videos" ON public.videos FOR SELECT TO authenticated USING (expires_at > now());
CREATE POLICY "Creators can upload videos" ON public.videos FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid() AND has_role(auth.uid(), 'creator'::app_role));
CREATE POLICY "Creators can delete own videos" ON public.videos FOR DELETE TO authenticated USING (creator_id = auth.uid());
CREATE POLICY "Admins can manage videos" ON public.videos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Video likes
CREATE TABLE public.video_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(video_id, user_id)
);

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view likes" ON public.video_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like" ON public.video_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can unlike" ON public.video_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Video comments
CREATE TABLE public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view comments" ON public.video_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can comment" ON public.video_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON public.video_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Video saves
CREATE TABLE public.video_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(video_id, user_id)
);

ALTER TABLE public.video_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own saves" ON public.video_saves FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can save" ON public.video_saves FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can unsave" ON public.video_saves FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Follows
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can follow" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid() AND follower_id != following_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- Storage bucket for videos
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true);

CREATE POLICY "Authenticated users can view videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'videos');
CREATE POLICY "Creators can upload videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos' AND has_role(auth.uid(), 'creator'::app_role));
CREATE POLICY "Creators can delete own videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'videos' AND (auth.uid()::text = (storage.foldername(name))[1]));

-- Triggers for like/comment counts
CREATE OR REPLACE FUNCTION public.update_video_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET like_count = like_count + 1 WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET like_count = like_count - 1 WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_video_like AFTER INSERT OR DELETE ON public.video_likes FOR EACH ROW EXECUTE FUNCTION public.update_video_like_count();

CREATE OR REPLACE FUNCTION public.update_video_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET comment_count = comment_count + 1 WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET comment_count = comment_count - 1 WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_video_comment AFTER INSERT OR DELETE ON public.video_comments FOR EACH ROW EXECUTE FUNCTION public.update_video_comment_count();
