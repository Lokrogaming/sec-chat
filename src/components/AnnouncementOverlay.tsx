import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Megaphone, X } from 'lucide-react';
import { renderMarkdown } from '@/lib/markdown';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function AnnouncementOverlay() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!user) return;
    loadAnnouncements();
  }, [user]);

  const loadAnnouncements = async () => {
    // Get dismissed announcement IDs
    const { data: dismissed } = await supabase
      .from('dismissed_announcements')
      .select('announcement_id')
      .eq('user_id', user!.id);

    const dismissedIds = (dismissed || []).map(d => d.announcement_id);

    // Get active announcements
    const { data } = await supabase
      .from('announcements')
      .select('id, title, content, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data) {
      const filtered = data.filter(a => !dismissedIds.includes(a.id));
      setAnnouncements(filtered);
      setCurrentIndex(0);
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

  const current = announcements[currentIndex] || announcements[0];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Megaphone className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate">{current.title}</h3>
            <p className="text-xs text-muted-foreground">
              {new Date(current.created_at).toLocaleDateString()}
              {announcements.length > 1 && ` · ${currentIndex + 1}/${announcements.length}`}
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

          <div className="flex gap-2 mt-4">
            {announcements.length > 1 && currentIndex < announcements.length - 1 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setCurrentIndex(i => i + 1)}
              >
                Next ({announcements.length - currentIndex - 1} more)
              </Button>
            )}
            <Button
              size="sm"
              className="flex-1"
              onClick={() => dismiss(current.id)}
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
