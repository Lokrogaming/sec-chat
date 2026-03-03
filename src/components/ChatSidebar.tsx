import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, MessageSquarePlus, Search, Settings, LogOut, Shield, Users, LockKeyhole, Share2, BookOpen } from 'lucide-react';
import ChatRequests from '@/components/ChatRequests';
import ConversationMenu from '@/components/ConversationMenu';
import { toast } from 'sonner';
import PresenceDot from '@/components/PresenceDot';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Contact {
  contact_user_id: string;
  profile: {
    display_name: string | null;
    avatar_url: string | null;
    user_id: string;
  };
}

interface Conversation {
  id: string;
  otherUser: {
    display_name: string | null;
    avatar_url: string | null;
    user_id: string;
  };
  lastMessage?: string;
  unreadCount: number;
}

interface SidebarProps {
  onSelectConversation: (id: string, otherUser: any) => void;
  onOpenProfile: () => void;
  selectedConversationId: string | null;
  isOnline?: (userId: string) => boolean;
}

export default function ChatSidebar({ onSelectConversation, onOpenProfile, selectedConversationId, isOnline }: SidebarProps) {
  const { user, signOut } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [addContactCode, setAddContactCode] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [myUserCode, setMyUserCode] = useState<string | null>(null);
  const { totalUnread, refetch: refetchUnread } = useUnreadCount();

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('user_code').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setMyUserCode(data.user_code);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadContacts();
    loadConversations();
  }, [user]);

  // Real-time refresh for conversations
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('sidebar-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadConversations();
        refetchUnread();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadContacts = async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('contact_user_id')
      .eq('user_id', user!.id);

    if (error || !data) return;

    const userIds = data.map(c => c.contact_user_id);
    if (userIds.length === 0) { setContacts([]); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    setContacts(
      data.map(c => ({
        contact_user_id: c.contact_user_id,
        profile: profiles?.find(p => p.user_id === c.contact_user_id) || {
          display_name: null, avatar_url: null, user_id: c.contact_user_id,
        },
      }))
    );
  };

  const loadConversations = async () => {
    const { data: myParticipations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user!.id);

    if (!myParticipations?.length) { setConversations([]); return; }

    const convIds = myParticipations.map(p => p.conversation_id);

    const { data: otherParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds)
      .neq('user_id', user!.id);

    if (!otherParticipants?.length) { setConversations([]); return; }

    const otherUserIds = [...new Set(otherParticipants.map(p => p.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', otherUserIds);

    // Check for blocked/ignored conversations
    const { data: settings } = await supabase
      .from('conversation_settings')
      .select('conversation_id, is_blocked, is_ignored, is_unread')
      .eq('user_id', user!.id)
      .in('conversation_id', convIds);

    const settingsMap = new Map(settings?.map(s => [s.conversation_id, s]) || []);

    const convs: Conversation[] = otherParticipants
      .filter(p => {
        const s = settingsMap.get(p.conversation_id);
        return !s?.is_blocked; // Hide blocked conversations
      })
      .map(p => ({
        id: p.conversation_id,
        otherUser: profiles?.find(pr => pr.user_id === p.user_id) || {
          display_name: null, avatar_url: null, user_id: p.user_id,
        },
        unreadCount: 0,
      }));

    // Fetch unread counts
    const { data: unreadData } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .neq('sender_id', user!.id)
      .is('read_at', null);

    if (unreadData) {
      const counts: Record<string, number> = {};
      unreadData.forEach(m => {
        counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
      });
      convs.forEach(c => {
        c.unreadCount = counts[c.id] || 0;
        // Add manual unread flag
        const s = settingsMap.get(c.id);
        if (s?.is_unread && c.unreadCount === 0) c.unreadCount = 1;
      });
    }

    setConversations(convs);
  };

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .neq('sender_id', user.id)
      .is('read_at', null);

    if (!error) {
      // Also clear manual unread flags
      await supabase
        .from('conversation_settings')
        .update({ is_unread: false })
        .eq('user_id', user.id)
        .eq('is_unread', true);

      toast.success('All messages marked as read');
      loadConversations();
      refetchUnread();
    }
  };

  const addContact = async () => {
    if (!addContactCode.trim() || !user) return;
    setAddingContact(true);

    const { data: targetProfile, error } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_code', addContactCode.trim())
      .single();

    if (error || !targetProfile) {
      toast.error('User not found');
      setAddingContact(false);
      return;
    }

    if (targetProfile.user_id === user.id) {
      toast.error("You can't add yourself!");
      setAddingContact(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('contacts')
      .insert({ user_id: user.id, contact_user_id: targetProfile.user_id });

    if (insertError) {
      if (insertError.code === '23505') toast.error('Already a contact');
      else toast.error('Failed to add contact');
    } else {
      toast.success('Contact added!');
      setAddContactCode('');
      setAddContactOpen(false);
      loadContacts();
    }
    setAddingContact(false);
  };

  const startConversation = async (contactUserId: string) => {
    if (!user) return;

    const existing = conversations.find(c => c.otherUser.user_id === contactUserId);
    if (existing) {
      onSelectConversation(existing.id, existing.otherUser);
      return;
    }

    const { data: convId, error: convError } = await supabase
      .rpc('create_conversation_with_participant', { other_user_id: contactUserId });

    if (convError || !convId) { toast.error('Failed to create conversation'); return; }

    const contact = contacts.find(c => c.contact_user_id === contactUserId);
    onSelectConversation(convId, contact?.profile || { display_name: null, avatar_url: null, user_id: contactUserId });
    loadConversations();
  };

  const filteredConversations = conversations.filter(c =>
    !searchQuery || c.otherUser.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-mono text-lg font-bold text-foreground">
              Sec<span className="text-primary">Chat</span>
            </h1>
            {totalUnread > 0 && (
              <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-9 w-9">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground font-mono">Add Contact</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">Enter the user's ID code to add them as a contact.</p>
                  <Input
                    value={addContactCode}
                    onChange={(e) => setAddContactCode(e.target.value)}
                    placeholder="Enter user ID code..."
                    className="bg-input border-border font-mono"
                  />
                  <Button
                    onClick={addContact}
                    disabled={addingContact || !addContactCode.trim()}
                    className="w-full gradient-primary text-primary-foreground font-semibold hover:opacity-90"
                  >
                    {addingContact ? 'Adding...' : 'Add Contact'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={() => {
              if (myUserCode) {
                const url = `${window.location.origin}/u/${myUserCode}`;
                navigator.clipboard.writeText(url);
                toast.success('Profile link copied!');
              }
            }} className="text-muted-foreground hover:text-primary h-9 w-9" title="Share profile">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onOpenProfile} className="text-muted-foreground hover:text-primary h-9 w-9">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive h-9 w-9">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search + Mark All Read */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-9 bg-input border-border"
            />
          </div>
          {totalUnread > 0 && (
            <Button variant="ghost" size="icon" onClick={markAllRead} className="text-muted-foreground hover:text-primary h-9 w-9 shrink-0" title="Mark all read">
              <BookOpen className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat Requests */}
      <ChatRequests onAccepted={(convId) => {
        loadConversations();
        loadContacts();
      }} />

      {/* Contacts */}
      {contacts.length > 0 && (
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contacts</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {contacts.map(c => (
              <button
                key={c.contact_user_id}
                onClick={() => startConversation(c.contact_user_id)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-secondary/50 transition-colors min-w-[60px]"
              >
                <div className="relative">
                  <Avatar className="h-10 w-10 border border-primary/20">
                    <AvatarImage src={c.profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground font-mono text-xs">
                      {c.profile.display_name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <PresenceDot
                    online={isOnline?.(c.contact_user_id) ?? false}
                    className="absolute -bottom-0.5 -right-0.5"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground truncate max-w-[56px]">
                  {c.profile.display_name || 'User'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
            <MessageSquarePlus className="h-10 w-10 mb-3 text-muted-foreground/30" />
            <p className="text-sm text-center">No conversations yet</p>
            <p className="text-xs text-center mt-1">Add a contact and start chatting!</p>
          </div>
        ) : (
          filteredConversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => {
                onSelectConversation(conv.id, conv.otherUser);
                // Clear manual unread flag when clicking
                supabase
                  .from('conversation_settings')
                  .update({ is_unread: false })
                  .eq('user_id', user!.id)
                  .eq('conversation_id', conv.id)
                  .then(() => {});
              }}
              className={`group w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors border-b border-border/50 ${
                selectedConversationId === conv.id ? 'bg-secondary/70' : ''
              }`}
            >
              <div className="relative shrink-0">
                <Avatar className="h-11 w-11 border border-primary/20">
                  <AvatarImage src={conv.otherUser.avatar_url || undefined} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground font-mono text-sm">
                    {conv.otherUser.display_name?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <PresenceDot
                  online={isOnline?.(conv.otherUser.user_id) ?? false}
                  className="absolute -bottom-0.5 -right-0.5"
                />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium text-foreground truncate">{conv.otherUser.display_name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <LockKeyhole className="h-2.5 w-2.5" /> Encrypted
                </p>
              </div>
              {conv.unreadCount > 0 && (
                <span className="shrink-0 flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                </span>
              )}
              <ConversationMenu conversationId={conv.id} onUpdate={loadConversations} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
