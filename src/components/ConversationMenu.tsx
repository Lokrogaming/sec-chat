import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MoreVertical, EyeOff, VolumeX, Ban } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  conversationId: string;
  onUpdate?: () => void;
}

export default function ConversationMenu({ conversationId, onUpdate }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const upsertSetting = async (field: string, value: boolean) => {
    if (!user) return;
    setLoading(true);

    const { data: existing } = await supabase
      .from('conversation_settings')
      .select('id')
      .eq('user_id', user.id)
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('conversation_settings')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('conversation_settings')
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
          [field]: value,
        });
    }

    const labels: Record<string, string> = {
      is_unread: value ? 'Marked as unread' : 'Marked as read',
      is_ignored: value ? 'Chat ignored' : 'Chat unignored',
      is_blocked: value ? 'User blocked' : 'User unblocked',
    };
    toast.success(labels[field] || 'Updated');
    setLoading(false);
    onUpdate?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border-border">
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); upsertSetting('is_unread', true); }}
          disabled={loading}
        >
          <EyeOff className="h-4 w-4 mr-2" />
          Mark as unread
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); upsertSetting('is_ignored', true); }}
          disabled={loading}
        >
          <VolumeX className="h-4 w-4 mr-2" />
          Ignore chat
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); upsertSetting('is_blocked', true); }}
          disabled={loading}
          className="text-destructive focus:text-destructive"
        >
          <Ban className="h-4 w-4 mr-2" />
          Block user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
