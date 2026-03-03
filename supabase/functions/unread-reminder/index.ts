import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find messages unread for more than 2 days
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    // Get distinct users with old unread messages
    const { data: unreadMessages, error } = await supabase
      .from('messages')
      .select('conversation_id, sender_id')
      .is('read_at', null)
      .lt('created_at', twoDaysAgo);

    if (error) throw error;
    if (!unreadMessages?.length) {
      return new Response(JSON.stringify({ message: 'No unread messages older than 2 days' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get conversation participants who need reminders
    const convIds = [...new Set(unreadMessages.map(m => m.conversation_id))];
    const senderIds = [...new Set(unreadMessages.map(m => m.sender_id))];

    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds);

    if (!participants) {
      return new Response(JSON.stringify({ message: 'No participants found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find users who need to be reminded (recipients, not senders)
    const usersToRemind = new Set<string>();
    for (const msg of unreadMessages) {
      const convParticipants = participants.filter(p => p.conversation_id === msg.conversation_id);
      for (const p of convParticipants) {
        if (p.user_id !== msg.sender_id) {
          usersToRemind.add(p.user_id);
        }
      }
    }

    // Get user emails from auth (using admin API)
    const remindedUsers: string[] = [];
    for (const userId of usersToRemind) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        // Send reminder email via Supabase auth magic link as a gentle nudge
        // In production, you'd use a proper email service here
        remindedUsers.push(userData.user.email);
      }
    }

    return new Response(JSON.stringify({
      message: `Found ${usersToRemind.size} users with unread messages older than 2 days`,
      users_to_remind: remindedUsers.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
