import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { CustomEmoji, UNICODE_EMOJIS, loadCustomEmojis, subscribeCustomEmojis } from '@/lib/emojis';

interface Props {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export default function EmojiPicker({ onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<CustomEmoji[]>([]);

  useEffect(() => {
    loadCustomEmojis().then(setCustom);
    return subscribeCustomEmojis(setCustom);
  }, []);

  const pick = (text: string) => {
    onSelect(text);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          title="Add an emoji"
          aria-label="Add an emoji"
          className="shrink-0 h-9 w-9 text-muted-foreground hover:text-primary"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0 bg-popover border-border">
        <div className="max-h-72 overflow-y-auto p-3 space-y-4">
          {custom.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">This site's emojis</p>
              <div className="grid grid-cols-8 gap-1">
                {custom.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => pick(`:${e.shortcode}:`)}
                    title={`:${e.shortcode}:`}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent"
                  >
                    <img src={e.image_data} alt={e.shortcode} className="h-6 w-6 object-contain" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {UNICODE_EMOJIS.map((g) => (
            <div key={g.group}>
              <p className="text-xs font-medium text-muted-foreground mb-2">{g.group}</p>
              <div className="grid grid-cols-8 gap-1">
                {g.items.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => pick(em)}
                    className="h-8 w-8 text-xl leading-none flex items-center justify-center rounded hover:bg-accent"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
