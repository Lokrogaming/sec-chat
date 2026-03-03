import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Ban, Clock, Trash2, Eye, ArrowLeft, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  user_code: string;
}

interface FlaggedMessage {
  id: string;
  sender_id: string;
  content: string;
  flagged_word: string;
  reviewed: boolean;
  created_at: string;
  conversation_id: string;
}

interface BannedUser {
  id: string;
  user_id: string;
  reason: string | null;
  ban_type: string;
  expires_at: string | null;
  created_at: string;
}

interface BannedIP {
  id: string;
  ip_address: string;
  reason: string | null;
  ban_type: string;
  expires_at: string | null;
  created_at: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [flagged, setFlagged] = useState<FlaggedMessage[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [bannedIPs, setBannedIPs] = useState<BannedIP[]>([]);
  const [banReason, setBanReason] = useState('');
  const [ipToBan, setIpToBan] = useState('');
  const [ipBanReason, setIpBanReason] = useState('');
  const [timeoutHours, setTimeoutHours] = useState('24');

  useEffect(() => {
    if (!user) return;
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadAll();
    }
  }, [isAdmin]);

  const checkAdmin = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user!.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const loadAll = async () => {
    const [profilesRes, flaggedRes, bannedRes, ipsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, display_name, avatar_url, user_code'),
      supabase.from('flagged_messages').select('*').eq('reviewed', false).order('created_at', { ascending: false }),
      supabase.from('banned_users').select('*').order('created_at', { ascending: false }),
      supabase.from('banned_ips').select('*').order('created_at', { ascending: false }),
    ]);
    if (profilesRes.data) setUsers(profilesRes.data);
    if (flaggedRes.data) setFlagged(flaggedRes.data as any);
    if (bannedRes.data) setBannedUsers(bannedRes.data as any);
    if (ipsRes.data) setBannedIPs(ipsRes.data as any);
  };

  const banUser = async (userId: string, type: 'permanent' | 'timeout') => {
    const expiresAt = type === 'timeout'
      ? new Date(Date.now() + parseInt(timeoutHours) * 3600000).toISOString()
      : null;

    const { error } = await supabase.from('banned_users').upsert({
      user_id: userId,
      banned_by: user!.id,
      reason: banReason || null,
      ban_type: type,
      expires_at: expiresAt,
    }, { onConflict: 'user_id' });

    if (error) toast.error('Failed to ban user');
    else { toast.success(type === 'timeout' ? 'User timed out' : 'User banned'); setBanReason(''); loadAll(); }
  };

  const unbanUser = async (banId: string) => {
    await supabase.from('banned_users').delete().eq('id', banId);
    toast.success('User unbanned');
    loadAll();
  };

  const banIP = async () => {
    if (!ipToBan.trim()) return;
    const { error } = await supabase.from('banned_ips').insert({
      ip_address: ipToBan.trim(),
      banned_by: user!.id,
      reason: ipBanReason || null,
      ban_type: 'permanent',
    });
    if (error) toast.error('Failed to ban IP');
    else { toast.success('IP banned'); setIpToBan(''); setIpBanReason(''); loadAll(); }
  };

  const unbanIP = async (id: string) => {
    await supabase.from('banned_ips').delete().eq('id', id);
    toast.success('IP unbanned');
    loadAll();
  };

  const reviewFlagged = async (id: string) => {
    await supabase.from('flagged_messages').update({ reviewed: true, reviewed_by: user!.id }).eq('id', id);
    toast.success('Marked as reviewed');
    loadAll();
  };

  const deleteUser = async (userId: string) => {
    // Delete profile (cascade will handle the rest via auth)
    await supabase.from('profiles').delete().eq('user_id', userId);
    toast.success('User profile deleted');
    loadAll();
  };

  if (isAdmin === null) {
    return <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">Checking access...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-destructive/50" />
          <h1 className="text-xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You don't have admin privileges.</p>
          <Button variant="outline" onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-mono font-bold text-foreground">Admin Panel</h1>
        </div>

        <Tabs defaultValue="moderation" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="moderation">Moderation Queue ({flagged.length})</TabsTrigger>
            <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
            <TabsTrigger value="bans">Bans ({bannedUsers.length})</TabsTrigger>
            <TabsTrigger value="ips">IP Bans ({bannedIPs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="moderation" className="space-y-3">
            {flagged.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Eye className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No flagged messages</p>
              </div>
            ) : flagged.map(f => (
              <div key={f.id} className="p-4 rounded-lg bg-card border border-border">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-foreground break-words">{f.content}</p>
                    <p className="text-xs text-destructive mt-1">Flagged word: <strong>{f.flagged_word}</strong></p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sender: {users.find(u => u.user_id === f.sender_id)?.display_name || f.sender_id.slice(0, 8)}
                      {' · '}
                      {new Date(f.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => reviewFlagged(f.id)}>Dismiss</Button>
                    <Button size="sm" variant="destructive" onClick={() => banUser(f.sender_id, 'permanent')}>
                      Ban Sender
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="users" className="space-y-2">
            {users.map(u => {
              const isBanned = bannedUsers.some(b => b.user_id === u.user_id);
              return (
                <div key={u.user_id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-mono">
                      {u.display_name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.display_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{u.user_code}</p>
                  </div>
                  {isBanned && <span className="text-xs text-destructive font-semibold">BANNED</span>}
                  {u.user_id !== user!.id && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => banUser(u.user_id, 'timeout')}>
                        <Clock className="h-3 w-3 mr-1" />Timeout
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => banUser(u.user_id, 'permanent')}>
                        <Ban className="h-3 w-3 mr-1" />Ban
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteUser(u.user_id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2 mt-3">
              <Input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Ban reason (optional)" className="bg-input border-border" />
              <Input value={timeoutHours} onChange={e => setTimeoutHours(e.target.value)} placeholder="Timeout hours" className="bg-input border-border w-32" type="number" />
            </div>
          </TabsContent>

          <TabsContent value="bans" className="space-y-2">
            {bannedUsers.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No banned users</p>
            ) : bannedUsers.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                <Ban className="h-4 w-4 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    {users.find(u => u.user_id === b.user_id)?.display_name || b.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.ban_type}{b.expires_at ? ` · Expires: ${new Date(b.expires_at).toLocaleString()}` : ''}{b.reason ? ` · ${b.reason}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => unbanUser(b.id)}>Unban</Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="ips" className="space-y-3">
            <div className="flex gap-2">
              <Input value={ipToBan} onChange={e => setIpToBan(e.target.value)} placeholder="IP address to ban" className="bg-input border-border" />
              <Input value={ipBanReason} onChange={e => setIpBanReason(e.target.value)} placeholder="Reason (optional)" className="bg-input border-border" />
              <Button onClick={banIP} className="gradient-primary text-primary-foreground shrink-0">
                <Globe className="h-4 w-4 mr-1" />Ban IP
              </Button>
            </div>
            {bannedIPs.map(ip => (
              <div key={ip.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                <Globe className="h-4 w-4 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-foreground font-mono">{ip.ip_address}</p>
                  <p className="text-xs text-muted-foreground">
                    {ip.ban_type}{ip.reason ? ` · ${ip.reason}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => unbanIP(ip.id)}>Unban</Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
