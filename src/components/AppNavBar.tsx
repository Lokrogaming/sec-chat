import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Video, Shield, Settings, LogOut, Share2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AppNavBarProps {
  onOpenProfile: () => void;
  onAddContact: () => void;
}

export default function AppNavBar({ onOpenProfile, onAddContact }: AppNavBarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null; user_code: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('display_name, avatar_url, user_code').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setProfile(data);
    });
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle().then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  const shareProfile = () => {
    if (profile?.user_code) {
      navigator.clipboard.writeText(`${window.location.origin}/u/${profile.user_code}`);
      toast.success('Profile link copied!');
    }
  };

  const navItems = [
    { icon: MessageSquare, label: 'Chat', path: '/', active: location.pathname === '/' || location.pathname === '/chat' },
    { icon: Video, label: 'Videos', path: '/videos', active: location.pathname === '/videos' },
  ];

  return (
    <div className="flex flex-col items-center w-14 h-full bg-card border-r border-border py-3 gap-1">
      {/* Avatar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onOpenProfile} className="mb-3">
            <Avatar className="h-9 w-9 border border-primary/30 hover:border-primary transition-colors">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-mono">
                {profile?.display_name?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Profile</TooltipContent>
      </Tooltip>

      {/* Main nav */}
      {navItems.map(item => (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(item.path)}
              className={`h-10 w-10 ${item.active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <item.icon className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      ))}

      {/* Admin */}
      {isAdmin && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
              className={`h-10 w-10 ${location.pathname === '/admin' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Shield className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Admin</TooltipContent>
        </Tooltip>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom actions */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onAddContact} className="h-10 w-10 text-muted-foreground hover:text-primary">
            <UserPlus className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Add Contact</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={shareProfile} className="h-10 w-10 text-muted-foreground hover:text-primary">
            <Share2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Share Profile</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onOpenProfile} className="h-10 w-10 text-muted-foreground hover:text-primary">
            <Settings className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Settings</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={signOut} className="h-10 w-10 text-muted-foreground hover:text-destructive">
            <LogOut className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Sign Out</TooltipContent>
      </Tooltip>
    </div>
  );
}
