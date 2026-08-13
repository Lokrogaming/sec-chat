import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CIPHERS, CipherId, getCipherMeta, isCipherSupported, publishPublicKey } from '@/lib/ciphers';
import { Button } from '@/components/ui/button';
import { Lock, Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Props {
  conversationId: string;
  cipher: CipherId;
  onChanged?: (id: CipherId) => void;
}

export default function EncryptionMenu({ conversationId, cipher, onChanged }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const current = getCipherMeta(cipher);

  const select = async (id: CipherId) => {
    if (id === cipher || !user) return;
    setSaving(true);
    try {
      if (!(await isCipherSupported(id))) {
        toast.error('This browser does not support that encryption mechanism.');
        return;
      }
      const meta = getCipherMeta(id);
      if (meta.keyExchange) {
        await publishPublicKey(id as 'x25519' | 'ecdh-p256', user.id);
      }
      const { error } = await supabase
        .from('conversations')
        .update({ cipher: id })
        .eq('id', conversationId);
      if (error) throw error;
      toast.success(`Encryption switched to ${meta.label}`);
      onChanged?.(id);
    } catch {
      toast.error('Could not change encryption for this chat.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          className="h-6 gap-1 px-1.5 text-[11px] text-primary/70 hover:text-primary"
        >
          <Lock className="h-3 w-3" />
          {current.short}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 bg-popover border-border">
        <DropdownMenuLabel className="text-xs">Encryption mechanism</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CIPHERS.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => select(c.id)}
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <span className="flex w-full items-center gap-2 text-sm">
              {c.label}
              {c.id === cipher && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </span>
            <span className="text-[11px] leading-snug text-muted-foreground">{c.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
