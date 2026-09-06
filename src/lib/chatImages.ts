import { supabase } from '@/integrations/supabase/client';

export const IMAGE_PREFIX = '[[img:';

/** Encode an uploaded image path as message text. */
export const encodeImageMessage = (path: string) => `${IMAGE_PREFIX}${path}]]`;

/** Returns the storage path if the message is an image message, otherwise null. */
export function parseImageMessage(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith(IMAGE_PREFIX) || !t.endsWith(']]')) return null;
  return t.slice(IMAGE_PREFIX.length, -2);
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Uploads an image into the conversation folder and registers its 7-day expiry. */
export async function uploadChatImage(
  file: File,
  conversationId: string,
  userId: string,
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('chat-images')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase.from('chat_images').insert({
    conversation_id: conversationId,
    uploader_id: userId,
    storage_path: path,
  });
  if (dbError) throw dbError;

  return path;
}

const urlCache = new Map<string, { url: string; until: number }>();

/** Creates (and caches) a temporary viewing link for a chat image. */
export async function getChatImageUrl(path: string): Promise<string | null> {
  const cached = urlCache.get(path);
  if (cached && cached.until > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from('chat-images')
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;

  urlCache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

/** Best-effort cleanup of images older than 7 days. */
export function runImageCleanup() {
  supabase.functions.invoke('cleanup-chat-images').catch(() => {});
}
