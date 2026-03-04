import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Megaphone, X, ExternalLink } from 'lucide-react';
import { renderMarkdown } from '@/lib/markdown';

interface AnnouncementLink {
  label: string;
  url: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  links: AnnouncementLink[];
}

export default function AnnouncementOverlay() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user) return;
    loadAnnouncements();
  }, [user]);

  const loadAnnouncements = async () => {
    const { data: dismissed } = await supabase
      .from('dismissed_announcements')
      .select('announcement_id')
      .eq('user_id', user!.id);

    const dismissedIds = (dismissed || []).map(d => d.announcement_id);

    const { data } = await supabase
      .from('announcements')
      .select('id, title, content, created_at, links')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data) {
      const filtered = data
        .filter(a => !dismissedIds.includes(a.id))
        .map(a => ({
          ...a,
          links: Array.isArray(a.links) ? (a.links as unknown as AnnouncementLink[]) : [],
        }));
      setAnnouncements(filtered);
    }
  };

  const dismiss = async (announcementId: string) => {
    await supabase.from('dismissed_announcements').insert({
      user_id: user!.id,
      announcement_id: announcementId,
    });
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
  };

  if (announcements.length === 0) return null;

  const current = announcements[0];
  const stackCount = Math.min(announcements.length, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md mx-4">
        {/* Stacked cards behind */}
        {stackCount >= 3 && (
          <div className="absolute inset-0 rounded-2xl bg-card/40 border border-border/30 shadow-lg translate-y-4 scale-[0.92]" />
        )}
        {stackCount >= 2 && (
          <div className="absolute inset-0 rounded-2xl bg-card/60 border border-border/50 shadow-lg translate-y-2 scale-[0.96]" />
        )}

        {/* Front card */}
        <div className="relative rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-5 pt-5 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Megaphone className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground truncate">{current.title}</h3>
              <p className="text-xs text-muted-foreground">
                {new Date(current.created_at).toLocaleDateString()}
                {announcements.length > 1 && ` · ${announcements.length} announcements`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => dismiss(current.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="px-5 pb-5">
            <div className="text-sm text-muted-foreground leading-relaxed">
              {renderMarkdown(current.content)}
            </div>

            {/* Links */}
            {current.links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {current.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 bg-primary/10 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {link.label}
                  </a>
                ))}
              </div>
            )}

            <Button
              size="sm"
              className="w-full mt-4"
              onClick={() => dismiss(current.id)}
            >
              {announcements.length > 1 ? `Got it (${announcements.length - 1} more)` : 'Got it'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
