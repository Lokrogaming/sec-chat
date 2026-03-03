import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useUnreadCount() {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);

  const fetchUnread = async () => {
    if (!user) { setTotalUnread(0); return; }
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .neq('sender_id', user.id)
      .is('read_at', null);
    setTotalUnread(count || 0);
  };

  useEffect(() => {
    fetchUnread();
    // Listen for new messages
    const channel = supabase
      .channel('global-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnread();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Update document title
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) SecChat` : 'SecChat';
  }, [totalUnread]);

  return { totalUnread, refetch: fetchUnread };
}
