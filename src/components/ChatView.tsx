import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { encryptMessage, decryptMessage, deriveConversationKey } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Lock } from 'lucide-react';
import { toast } from 'sonner';
import PresenceDot from '@/components/PresenceDot';

interface Message {
  id: string;
  sender_id: string;
  encrypted_content: string;
  iv: string;
  created_at: string;
  decrypted?: string;
}

interface ChatViewProps {
  conversationId: string;
  otherUser: { display_name: string | null; avatar_url: string | null; user_id: string } | null;
  isOnline?: boolean;
}

export default function ChatView({ conversationId, otherUser, isOnline }: ChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    deriveConversationKey(conversationId).then(setCryptoKey);
  }, [conversationId]);

  useEffect(() => {
    if (!cryptoKey) return;
    loadMessages();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const msg = payload.new as Message;
        try {
          msg.decrypted = await decryptMessage(msg.encrypted_content, msg.iv, cryptoKey);
        } catch {
          msg.decrypted = '[Decryption failed]';
        }
        setMessages(prev => [...prev, msg]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, cryptoKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    if (!cryptoKey) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) { toast.error('Failed to load messages'); return; }

    const decrypted = await Promise.all(
      (data || []).map(async (msg: any) => {
        try {
          msg.decrypted = await decryptMessage(msg.encrypted_content, msg.iv, cryptoKey);
        } catch {
          msg.decrypted = '[Decryption failed]';
        }
        return msg;
      })
    );
    setMessages(decrypted);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !cryptoKey) return;

    setSending(true);
    try {
      const { encrypted, iv } = await encryptMessage(newMessage.trim(), cryptoKey);
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        encrypted_content: encrypted,
        iv,
      });
      if (error) throw error;
      setNewMessage('');
    } catch (err: any) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="relative">
          <Avatar className="h-10 w-10 border border-primary/20">
            <AvatarImage src={otherUser?.avatar_url || undefined} />
            <AvatarFallback className="bg-secondary text-secondary-foreground font-mono text-sm">
              {otherUser?.display_name?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <PresenceDot
            online={isOnline ?? false}
            className="absolute -bottom-0.5 -right-0.5"
            size="md"
          />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{otherUser?.display_name || 'Unknown'}</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className={isOnline ? 'text-primary' : 'text-muted-foreground'}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span className="text-muted-foreground/30">•</span>
            <span className="flex items-center gap-1 text-primary/60">
              <Lock className="h-3 w-3" />
              AES-256-GCM
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <div className="text-center">
              <Lock className="h-8 w-8 mx-auto mb-2 text-primary/30" />
              <p>Messages are end-to-end encrypted</p>
              <p className="text-xs mt-1">Send the first message!</p>
            </div>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isMine
                  ? 'bg-primary/15 border border-primary/20 text-foreground'
                  : 'bg-secondary border border-border text-foreground'
              }`}>
                <p className="text-sm break-words">{msg.decrypted || '...'}</p>
                <p className={`text-[10px] mt-1 ${isMine ? 'text-primary/50' : 'text-muted-foreground'}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-border p-3 flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-input border-border"
          disabled={sending}
        />
        <Button
          type="submit"
          disabled={sending || !newMessage.trim()}
          size="icon"
          className="gradient-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
