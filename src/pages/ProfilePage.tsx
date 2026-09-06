import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Save, Copy, Plus, Trash2, ArrowLeft, Link2, Check, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileData {
  display_name: string | null;
  bio: string | null;
  links: { label: string; url: string }[];
  avatar_url: string | null;
  user_code: string;
}

export default function ProfilePage({ onBack }: { onBack: () => void }) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

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
      toast.error('We could not load your profile. Please try again.');
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
      toast.error('The photo could not be uploaded.');
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
    toast.success('Your picture was updated.');
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
      toast.error('Your changes could not be saved.');
    } else {
      toast.success('Your changes were saved.');
    }
    setSaving(false);
  };

  const copy = (value: string, what: 'code' | 'link', message: string) => {
    navigator.clipboard.writeText(value);
    setCopied(what);
    toast.success(message);
    setTimeout(() => setCopied(null), 2000);
  };

  const addLink = () => setLinks([...links, { label: '', url: '' }]);
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: 'label' | 'url', value: string) => {
    const updated = [...links];
    updated[i][field] = value;
    setLinks(updated);
  };

  if (!profile) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-mono text-base font-semibold text-foreground">Your profile</h2>
        <Button
          onClick={saveProfile}
          disabled={saving}
          size="sm"
          className="ml-auto gradient-primary text-primary-foreground font-semibold hover:opacity-90"
        >
          <Save className="mr-1.5 h-4 w-4" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {/* Identity card */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16 border-2 border-primary/30">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xl font-mono">
                  {displayName?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-80 transition-opacity" title="Change your picture">
                <Camera className="h-3.5 w-3.5" />
                <span className="sr-only">Change your picture</span>
                <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={uploading} />
              </label>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="display-name" className="text-xs text-muted-foreground">Your name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should people see you?"
                className="h-9 bg-input border-border"
              />
            </div>
          </div>
          {uploading && <p className="mt-2 text-xs text-muted-foreground animate-pulse">Uploading your picture…</p>}
        </section>

        {/* Sharing card */}
        <section className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Let others find you</h3>
            <p className="text-xs text-muted-foreground">Share your personal code or your profile link, and people can start a chat with you.</p>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <code className="font-mono text-base tracking-widest text-primary text-glow">{profile.user_code}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(profile.user_code, 'code', 'Your code was copied.')}
              className="h-8 text-muted-foreground hover:text-primary"
            >
              {copied === 'code' ? <Check className="mr-1 h-4 w-4 text-primary" /> : <Copy className="mr-1 h-4 w-4" />}
              Copy code
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => copy(`${window.location.origin}/u/${profile.user_code}`, 'link', 'Your profile link was copied.')}
          >
            {copied === 'link' ? <Check className="mr-2 h-4 w-4 text-primary" /> : <Link2 className="mr-2 h-4 w-4" />}
            Copy profile link
          </Button>
        </section>

        {/* About */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <Label htmlFor="bio" className="text-sm font-semibold text-foreground">About you</Label>
          <p className="text-xs text-muted-foreground">A short text that other people see on your profile.</p>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="bg-input border-border resize-none"
            placeholder="For example: Grandma of three, loves gardening."
          />
        </section>

        {/* Links */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Your links</h3>
              <p className="text-xs text-muted-foreground">Websites you want to show on your profile.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={addLink} className="h-8 text-primary hover:text-primary/80">
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
          {links.length === 0 && <p className="text-xs text-muted-foreground">No links yet.</p>}
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <Input value={link.label} onChange={(e) => updateLink(i, 'label', e.target.value)} placeholder="Name" className="h-9 flex-1 bg-input border-border" />
              <Input value={link.url} onChange={(e) => updateLink(i, 'url', e.target.value)} placeholder="https://…" className="h-9 flex-[2] bg-input border-border" />
              <Button variant="ghost" size="icon" aria-label="Remove link" onClick={() => removeLink(i)} className="h-9 w-9 shrink-0 text-destructive hover:text-destructive/80">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-2 pb-4 sm:flex-row">
          <Button onClick={saveProfile} disabled={saving} className="flex-1 gradient-primary text-primary-foreground font-semibold hover:opacity-90">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button variant="outline" onClick={() => signOut()} className="sm:w-40">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
