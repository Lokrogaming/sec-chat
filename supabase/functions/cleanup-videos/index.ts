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

    // Find expired videos
    const { data: expiredVideos, error } = await supabase
      .from('videos')
      .select('id, video_url, creator_id')
      .lt('expires_at', new Date().toISOString());

    if (error) throw error;
    if (!expiredVideos?.length) {
      return new Response(JSON.stringify({ message: 'No expired videos', deleted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let deleted = 0;
    for (const video of expiredVideos) {
      // Extract storage path from URL
      const urlParts = video.video_url.split('/storage/v1/object/public/videos/');
      if (urlParts.length === 2) {
        const storagePath = decodeURIComponent(urlParts[1]);
        await supabase.storage.from('videos').remove([storagePath]);
      }

      // Delete from database (cascades to likes, comments, saves)
      await supabase.from('videos').delete().eq('id', video.id);
      deleted++;
    }

    return new Response(JSON.stringify({
      message: `Cleaned up ${deleted} expired videos`,
      deleted,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
