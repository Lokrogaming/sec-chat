let blacklistWords: string[] = [];
let loaded = false;

export async function loadBlacklist(): Promise<string[]> {
  if (loaded) return blacklistWords;
  try {
    const res = await fetch('/wordblacklist.txt');
    const text = await res.text();
    blacklistWords = text
      .split('\n')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0);
    loaded = true;
  } catch {
    blacklistWords = [];
  }
  return blacklistWords;
}

export function checkBlacklist(message: string): string | null {
  const lower = message.toLowerCase();
  for (const word of blacklistWords) {
    if (lower.includes(word)) return word;
  }
  return null;
}
