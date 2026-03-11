import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { MessageSquare, Video, Shield, User } from 'lucide-react';
import { useUnreadCount } from '@/hooks/useUnreadCount';

interface MobileBottomNavProps {
  onOpenProfile: () => void;
}

export default function MobileBottomNav({ onOpenProfile }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const { totalUnread } = useUnreadCount();

  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle().then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  const navItems = [
    { icon: MessageSquare, label: 'Chat', path: '/chat', active: location.pathname === '/' || location.pathname === '/chat', badge: totalUnread, action: () => navigate('/chat') },
    { icon: Video, label: 'Videos', path: '/videos', active: location.pathname === '/videos', action: () => navigate('/videos') },
    ...(isAdmin ? [{ icon: Shield, label: 'Admin', path: '/admin', active: location.pathname === '/admin', action: () => navigate('/admin') }] : []),
    { icon: User, label: 'Profile', path: '/profile', active: false, action: onOpenProfile },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border">
      <div className="flex items-center justify-around h-14">
        {navItems.map(item => (
          <button
            key={item.label}
            onClick={item.action}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative ${
              item.active ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <div className="relative">
              <item.icon className="h-5 w-5" />
              {'badge' in item && item.badge && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
      {/* Safe area padding for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
