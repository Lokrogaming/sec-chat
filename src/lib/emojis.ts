import { supabase } from '@/integrations/supabase/client';

export interface CustomEmoji {
  id: string;
  shortcode: string;
  image_data: string;
}

/** Output size all emojis are compressed to (renders at text size). */
export const EMOJI_PIXEL_SIZE = 64;

let cache: CustomEmoji[] | null = null;
let inflight: Promise<CustomEmoji[]> | null = null;
const listeners = new Set<(list: CustomEmoji[]) => void>();

export async function loadCustomEmojis(force = false): Promise<CustomEmoji[]> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = supabase
    .from('emojis')
    .select('id, shortcode, image_data')
    .order('shortcode')
    .then(({ data }) => {
      cache = (data as CustomEmoji[]) || [];
      listeners.forEach((l) => l(cache!));
      inflight = null;
      return cache;
    });
  return inflight;
}

export function subscribeCustomEmojis(cb: (list: CustomEmoji[]) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emojiMapFrom(list: CustomEmoji[]): Record<string, string> {
  const map: Record<string, string> = {};
  list.forEach((e) => { map[e.shortcode] = e.image_data; });
  return map;
}

/** Renders a file (image or svg) into a square, compressed PNG data URL. */
export async function processEmojiFile(
  file: File,
  opts: { zoom: number; offsetX: number; offsetY: number } = { zoom: 1, offsetX: 0, offsetY: 0 }
): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return processEmojiSource(dataUrl, opts);
}

export async function processEmojiSource(
  src: string,
  opts: { zoom: number; offsetX: number; offsetY: number } = { zoom: 1, offsetX: 0, offsetY: 0 }
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not read this image'));
    i.src = src;
  });

  const size = EMOJI_PIXEL_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';

  const natW = img.naturalWidth || size;
  const natH = img.naturalHeight || size;
  // "cover" the square, then apply zoom + offsets (offsets are -1..1 of the square)
  const base = Math.max(size / natW, size / natH);
  const scale = base * opts.zoom;
  const drawW = natW * scale;
  const drawH = natH * scale;
  const dx = (size - drawW) / 2 + (opts.offsetX * size) / 2;
  const dy = (size - drawH) / 2 + (opts.offsetY * size) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);

  return canvas.toDataURL('image/png');
}

/** Popular unicode emojis for the picker. */
export const UNICODE_EMOJIS: { group: string; items: string[] }[] = [
  {
    group: 'Smileys',
    items: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','🤪','🤨','🧐','🤓','😎','🥳','😏','😌','😔','😪','😴','🙄','😬','🤥','😷','🤒','🤕','🥴','😵','🤯','🤠','😳','🥺','😢','😭','😤','😠','😡','🤬','😱','😨','😰','😥','🤗','🤔','🤭','🤫','😶','😐','😑'],
  },
  {
    group: 'Gestures & People',
    items: ['👍','👎','👌','✌️','🤞','🤟','🤘','👋','🤚','🖐️','✋','👏','🙌','🙏','💪','🦾','👀','🧠','👶','🧑','👩','👨','🧓','👴','👵','🕺','💃','🧑‍💻','👮','🧑‍🚀'],
  },
  {
    group: 'Hearts & Symbols',
    items: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯','✨','⭐','🌟','⚡','🔥','💥','🎉','🎊','🎁','🏆','🥇','✅','❌','⚠️','🔒','🔓','🔑','🛡️','👁️','💬','📌','⏰'],
  },
  {
    group: 'Animals & Nature',
    items: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦅','🦉','🦄','🐝','🦋','🐢','🐍','🐙','🐳','🐬','🌵','🌲','🌸','🌻','🌈','☀️','🌙','❄️'],
  },
  {
    group: 'Food & Travel',
    items: ['🍏','🍎','🍌','🍉','🍇','🍓','🍒','🍑','🥑','🍔','🍟','🍕','🌭','🌮','🍿','🍩','🍪','🎂','🍰','☕','🍵','🍺','🍷','🚗','✈️','🚀','🚲','🏠','🏝️','⛰️','🎮','🎧'],
  },
];
