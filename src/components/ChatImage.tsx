import { useEffect, useState } from 'react';
import { getChatImageUrl } from '@/lib/chatImages';
import { ImageOff, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

export default function ChatImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getChatImageUrl(path).then((u) => {
      if (!active) return;
      if (u) setUrl(u); else setFailed(true);
    });
    return () => { active = false; };
  }, [path]);

  if (failed) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <ImageOff className="h-4 w-4" />
        <span>This photo is no longer available (photos are deleted after 7 days).</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => url && setOpen(true)}
        className="block overflow-hidden rounded-lg border border-border/60"
        aria-label="Open photo"
      >
        {url ? (
          <img
            src={url}
            alt="Shared photo"
            loading="lazy"
            onError={() => setFailed(true)}
            className="max-h-64 w-full max-w-[15rem] object-cover"
          />
        ) : (
          <div className="h-32 w-40 animate-pulse bg-muted" />
        )}
      </button>
      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" /> Available for 7 days
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl bg-background p-2">
          <DialogTitle className="sr-only">Shared photo</DialogTitle>
          {url && <img src={url} alt="Shared photo" className="max-h-[80vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
