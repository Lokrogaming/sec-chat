import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquarePlus, ExternalLink, Check, Clock, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface PublicProfile {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  links: { label: string; url: string }[] | null;
  avatar_url: string | null;
  user_code: string;
}

export default function PublicProfilePage() {
  const { userCode } = useParams<{ userCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'accepted' | 'sending'>('none');
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    if (userCode) loadProfile();
  }, [userCode, user]);

  const loadProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, bio, links, avatar_url, user_code')
      .eq('user_code', userCode!)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    setProfile(data as PublicProfile);
    setIsOwnProfile(user?.id === data.user_id);

    // Check existing chat request status
    if (user && user.id !== data.user_id) {
      const { data: existing } = await supabase
        .from('chat_requests')
        .select('status')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${data.user_id}),and(sender_id.eq.${data.user_id},receiver_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        setRequestStatus(existing.status as 'pending' | 'accepted');
      }

      // Also check if already contacts
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('contact_user_id', data.user_id)
        .maybeSingle();

      if (contact) setRequestStatus('accepted');
    }

    setLoading(false);
  };

  const sendChatRequest = async () => {
    if (!user || !profile) return;
    setRequestStatus('sending');

    const { error } = await supabase
      .from('chat_requests')
      .insert({ sender_id: user.id, receiver_id: profile.user_id });

    if (error) {
      if (error.code === '23505') {
        toast.error('Request already sent');
        setRequestStatus('pending');
      } else {
        toast.error('Failed to send request');
        setRequestStatus('none');
      }
      return;
    }

    setRequestStatus('pending');
    toast.success('Chat request sent!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse font-mono">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground font-mono">User not found</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go back
        </Button>
      </div>
    );
  }

  const links = (profile.links || []) as { label: string; url: string }[];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-mono text-sm text-muted-foreground">
              Cipher<span className="text-primary">Chat</span> Profile
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-24 w-24 border-2 border-primary/30">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-secondary text-secondary-foreground text-2xl font-mono">
                {profile.display_name?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">
                {profile.display_name || 'Anonymous'}
              </h2>
              <code className="text-xs text-muted-foreground font-mono">#{profile.user_code}</code>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-secondary-foreground text-center leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Links */}
          {links.length > 0 && (
            <div className="space-y-2">
              {links.filter(l => l.url.trim()).map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{link.label || link.url}</span>
                </a>
              ))}
            </div>
          )}

          {/* Chat Request Button */}
          {user && !isOwnProfile && (
            <div className="pt-2">
              {requestStatus === 'none' && (
                <Button onClick={sendChatRequest} className="w-full gradient-primary text-primary-foreground font-semibold hover:opacity-90">
                  <MessageSquarePlus className="mr-2 h-4 w-4" /> Send Chat Request
                </Button>
              )}
              {requestStatus === 'sending' && (
                <Button disabled className="w-full">
                  Sending...
                </Button>
              )}
              {requestStatus === 'pending' && (
                <Button disabled variant="secondary" className="w-full">
                  <Clock className="mr-2 h-4 w-4" /> Request Pending
                </Button>
              )}
              {requestStatus === 'accepted' && (
                <Button disabled variant="secondary" className="w-full text-primary">
                  <Check className="mr-2 h-4 w-4" /> Already Connected
                </Button>
              )}
            </div>
          )}

          {!user && (
            <Button onClick={() => navigate('/auth')} className="w-full gradient-primary text-primary-foreground font-semibold hover:opacity-90">
              Sign in to send a chat request
            </Button>
          )}

          {isOwnProfile && (
            <p className="text-xs text-muted-foreground text-center">This is your profile</p>
          )}
        </div>
      </div>
    </div>
  );
}
