import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Save, Copy, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileData {
  display_name: string | null;
  bio: string | null;
  links: { label: string; url: string }[];
  avatar_url: string | null;
  user_code: string;
}

export default function ProfilePage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user!.id)
      .single();
    if (error) {
      toast.error('Failed to load profile');
      return;
    }
    setProfile(data as any);
    setDisplayName(data.display_name || '');
    setBio(data.bio || '');
    setLinks((data.links as any) || []);
    setAvatarUrl(data.avatar_url);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const filePath = `${user.id}/avatar.${file.name.split('.').pop()}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload avatar');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    setAvatarUrl(publicUrl);

    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('user_id', user.id);

    setUploading(false);
    toast.success('Avatar updated!');
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        links: links.filter(l => l.url.trim()),
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile saved!');
    }
    setSaving(false);
  };

  const copyUserCode = () => {
    if (profile?.user_code) {
      navigator.clipboard.writeText(profile.user_code);
      toast.success('User ID copied!');
    }
  };

  const addLink = () => setLinks([...links, { label: '', url: '' }]);
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: 'label' | 'url', value: string) => {
    const updated = [...links];
    updated[i][field] = value;
    setLinks(updated);
  };

  if (!profile) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-mono text-lg font-semibold text-foreground">Profile</h2>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar className="h-24 w-24 border-2 border-primary/30">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-secondary text-secondary-foreground text-2xl font-mono">
                {displayName?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-80 transition-opacity">
              <Camera className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={uploading} />
            </label>
          </div>
          {uploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading...</span>}
        </div>

        {/* User Code */}
        <div className="rounded-lg border border-border bg-secondary/50 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Your User ID</p>
          <div className="flex items-center justify-center gap-2">
            <code className="font-mono text-lg text-primary text-glow tracking-wider">
              {profile.user_code}
            </code>
            <Button variant="ghost" size="icon" onClick={copyUserCode} className="text-muted-foreground hover:text-primary h-8 w-8">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Share this to let others add you</p>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label className="text-secondary-foreground">Display Name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-input border-border" />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label className="text-secondary-foreground">Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="bg-input border-border resize-none" placeholder="Tell people about yourself..." />
        </div>

        {/* Links */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-secondary-foreground">Links</Label>
            <Button variant="ghost" size="sm" onClick={addLink} className="text-primary hover:text-primary/80 h-8">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <Input value={link.label} onChange={(e) => updateLink(i, 'label', e.target.value)} placeholder="Label" className="bg-input border-border flex-1" />
              <Input value={link.url} onChange={(e) => updateLink(i, 'url', e.target.value)} placeholder="https://..." className="bg-input border-border flex-[2]" />
              <Button variant="ghost" size="icon" onClick={() => removeLink(i)} className="text-destructive hover:text-destructive/80 h-10 w-10 shrink-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Save */}
        <Button onClick={saveProfile} disabled={saving} className="w-full gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </div>
  );
}
