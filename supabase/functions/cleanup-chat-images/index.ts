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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: expired, error } = await supabase
      .from('chat_images')
      .select('id, storage_path')
      .lt('expires_at', new Date().toISOString())
      .limit(500);

    if (error) throw error;

    if (!expired?.length) {
      return new Response(JSON.stringify({ deleted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paths = expired.map((r) => r.storage_path);
    await supabase.storage.from('chat-images').remove(paths);
    await supabase.from('chat_images').delete().in('id', expired.map((r) => r.id));

    return new Response(JSON.stringify({ deleted: paths.length }), {
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
