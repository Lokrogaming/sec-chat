import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, MessageSquarePlus, Search, Settings, LogOut, Shield, Users, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import PresenceDot from '@/components/PresenceDot';
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

  useEffect(() => {
    if (!user) return;
    loadContacts();
    loadConversations();
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
    // Get conversations the user is part of
    const { data: myParticipations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user!.id);

    if (!myParticipations?.length) { setConversations([]); return; }

    const convIds = myParticipations.map(p => p.conversation_id);

    // Get other participants
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

    const convs: Conversation[] = otherParticipants.map(p => ({
      id: p.conversation_id,
      otherUser: profiles?.find(pr => pr.user_id === p.user_id) || {
        display_name: null, avatar_url: null, user_id: p.user_id,
      },
    }));

    setConversations(convs);
  };

  const addContact = async () => {
    if (!addContactCode.trim() || !user) return;
    setAddingContact(true);

    // Look up user by code
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

    // Check if conversation already exists
    const existing = conversations.find(c => c.otherUser.user_id === contactUserId);
    if (existing) {
      onSelectConversation(existing.id, existing.otherUser);
      return;
    }

    // Create new conversation with participants atomically
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
              Cipher<span className="text-primary">Chat</span>
            </h1>
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
            <Button variant="ghost" size="icon" onClick={onOpenProfile} className="text-muted-foreground hover:text-primary h-9 w-9">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive h-9 w-9">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="pl-9 bg-input border-border"
          />
        </div>
      </div>

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
              onClick={() => onSelectConversation(conv.id, conv.otherUser)}
              className={`w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors border-b border-border/50 ${
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
            </button>
          ))
        )}
      </div>
    </div>
  );
}
