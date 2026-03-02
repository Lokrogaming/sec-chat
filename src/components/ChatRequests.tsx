import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Check, X, Inbox } from 'lucide-react';
import { toast } from 'sonner';

interface ChatRequest {
  id: string;
  sender_id: string;
  status: string;
  created_at: string;
  senderProfile: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Props {
  onAccepted: (conversationId: string) => void;
}

export default function ChatRequests({ onAccepted }: Props) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadRequests();
  }, [user]);

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from('chat_requests')
      .select('id, sender_id, status, created_at')
      .eq('receiver_id', user!.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data?.length) { setRequests([]); return; }

    const senderIds = data.map(r => r.sender_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', senderIds);

    setRequests(data.map(r => ({
      ...r,
      senderProfile: profiles?.find(p => p.user_id === r.sender_id) || { display_name: null, avatar_url: null },
    })));
  };

  const acceptRequest = async (requestId: string) => {
    setProcessing(requestId);
    const { data: convId, error } = await supabase.rpc('accept_chat_request', { request_id: requestId });

    if (error) {
      toast.error('Failed to accept request');
      setProcessing(null);
      return;
    }

    toast.success('Chat request accepted!');
    setRequests(prev => prev.filter(r => r.id !== requestId));
    setProcessing(null);
    if (convId) onAccepted(convId);
  };

  const declineRequest = async (requestId: string) => {
    setProcessing(requestId);
    const { error } = await supabase
      .from('chat_requests')
      .update({ status: 'declined' })
      .eq('id', requestId);

    if (error) {
      toast.error('Failed to decline request');
    } else {
      toast.success('Request declined');
      setRequests(prev => prev.filter(r => r.id !== requestId));
    }
    setProcessing(null);
  };

  if (requests.length === 0) return null;

  return (
    <div className="border-b border-border p-3">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Inbox className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Chat Requests
        </span>
        <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
          {requests.length}
        </span>
      </div>
      <div className="space-y-1">
        {requests.map(req => (
          <div key={req.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
            <Avatar className="h-8 w-8 border border-primary/20 shrink-0">
              <AvatarImage src={req.senderProfile.avatar_url || undefined} />
              <AvatarFallback className="bg-secondary text-secondary-foreground font-mono text-xs">
                {req.senderProfile.display_name?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground truncate flex-1">
              {req.senderProfile.display_name || 'User'}
            </span>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => acceptRequest(req.id)}
                disabled={processing === req.id}
                className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => declineRequest(req.id)}
                disabled={processing === req.id}
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
