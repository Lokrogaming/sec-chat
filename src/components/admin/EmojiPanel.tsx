import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Trash2, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CustomEmoji, EMOJI_PIXEL_SIZE, loadCustomEmojis, processEmojiSource } from '@/lib/emojis';

export default function EmojiPanel({ userId }: { userId: string }) {
  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [shortcode, setShortcode] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setEmojis(await loadCustomEmojis(true));

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!source) { setPreview(null); return; }
    let cancelled = false;
    processEmojiSource(source, { zoom, offsetX, offsetY })
      .then((d) => { if (!cancelled) setPreview(d); })
      .catch(() => toast.error('Could not read this image'));
    return () => { cancelled = true; };
  }, [source, zoom, offsetX, offsetY]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast.error('Please choose an image or SVG file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Please choose a file smaller than 2 MB'); return; }
    setZoom(1); setOffsetX(0); setOffsetY(0);
    if (!shortcode) setShortcode(file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_+-]/g, '_').slice(0, 30));
    const reader = new FileReader();
    reader.onload = () => setSource(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const code = shortcode.trim().toLowerCase().replace(/[^a-z0-9_+-]/g, '_');
    if (!preview) { toast.error('Choose an image first'); return; }
    if (!code) { toast.error('Give the emoji a short name'); return; }
    setSaving(true);
    const { error } = await supabase.from('emojis').insert({
      shortcode: code,
      image_data: preview,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'That name is already used' : 'Could not save the emoji');
      return;
    }
    toast.success(`Emoji :${code}: added`);
    setSource(null); setPreview(null); setShortcode('');
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('emojis').delete().eq('id', id);
    if (error) { toast.error('Could not delete this emoji'); return; }
    toast.success('Emoji deleted');
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Add an emoji</h3>
          <p className="text-sm text-muted-foreground">
            Upload a picture or SVG. It is cut to a square and shrunk to {EMOJI_PIXEL_SIZE}×{EMOJI_PIXEL_SIZE} so it always
            matches the normal text size in chats.
          </p>
        </div>

        <input ref={fileRef} type="file" accept="image/*,.svg" className="hidden" onChange={onFile} />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" /> Choose image or SVG
        </Button>

        {preview && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="space-y-2">
              <div className="h-32 w-32 rounded-lg border border-border bg-muted/30 flex items-center justify-center">
                <img src={preview} alt="Emoji preview" className="h-24 w-24 object-contain" />
              </div>
              <p className="text-xs text-muted-foreground">
                In text: <span className="align-text-bottom">Hello </span>
                <img src={preview} alt="" className="inline-block align-text-bottom h-[1.25em] w-[1.25em]" />
              </p>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="text-sm font-medium">Zoom</label>
                <Slider value={[zoom]} min={0.5} max={3} step={0.05} onValueChange={([v]) => setZoom(v)} />
              </div>
              <div>
                <label className="text-sm font-medium">Move left / right</label>
                <Slider value={[offsetX]} min={-1} max={1} step={0.02} onValueChange={([v]) => setOffsetX(v)} />
              </div>
              <div>
                <label className="text-sm font-medium">Move up / down</label>
                <Slider value={[offsetY]} min={-1} max={1} step={0.02} onValueChange={([v]) => setOffsetY(v)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Short name (used as :name:)</label>
                <Input
                  value={shortcode}
                  onChange={(e) => setShortcode(e.target.value)}
                  placeholder="party_cat"
                  className="bg-input border-border"
                />
              </div>
              <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save emoji
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Emojis on this site ({emojis.length})</h3>
        {emojis.length === 0 && <p className="text-sm text-muted-foreground">No emojis added yet.</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {emojis.map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
              <img src={e.image_data} alt={e.shortcode} className="h-8 w-8 object-contain" />
              <span className="text-sm truncate flex-1">:{e.shortcode}:</span>
              <Button variant="ghost" size="icon" aria-label="Delete emoji" onClick={() => remove(e.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
