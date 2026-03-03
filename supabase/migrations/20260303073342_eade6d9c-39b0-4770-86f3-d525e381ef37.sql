
-- Admin roles system
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Banned users table
CREATE TABLE public.banned_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL,
  reason text,
  ban_type text NOT NULL DEFAULT 'permanent', -- 'permanent' or 'timeout'
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage bans" ON public.banned_users FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can check own ban" ON public.banned_users FOR SELECT USING (user_id = auth.uid());

-- Banned IPs table
CREATE TABLE public.banned_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  banned_by uuid NOT NULL,
  reason text,
  ban_type text NOT NULL DEFAULT 'permanent',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip_address)
);
ALTER TABLE public.banned_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage ip bans" ON public.banned_ips FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Flagged messages table (for blacklist violations)
CREATE TABLE public.flagged_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid,
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  flagged_word text NOT NULL,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flagged_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage flagged messages" ON public.flagged_messages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Blocked/ignored conversations per user
CREATE TABLE public.conversation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  is_blocked boolean NOT NULL DEFAULT false,
  is_ignored boolean NOT NULL DEFAULT false,
  is_unread boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, conversation_id)
);
ALTER TABLE public.conversation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON public.conversation_settings FOR ALL USING (user_id = auth.uid());

-- Enable realtime for chat_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_requests;
