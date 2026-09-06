import React from 'react';

/** Replaces :shortcode: with the matching custom emoji image, sized to the text. */
function renderEmojis(text: string, emojis: Record<string, string>, keyPrefix: string): React.ReactNode[] {
  if (!text) return [text];
  const codes = Object.keys(emojis);
  if (codes.length === 0) return [text];

  const parts: React.ReactNode[] = [];
  const regex = /:([a-zA-Z0-9_+-]{1,40}):/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const src = emojis[match[1]];
    if (!src) continue;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <img
        key={`${keyPrefix}-e${match.index}`}
        src={src}
        alt={`:${match[1]}:`}
        title={`:${match[1]}:`}
        className="inline-block align-text-bottom h-[1.25em] w-[1.25em] object-contain"
        loading="lazy"
      />
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

// Simple markdown renderer for bold, italic, links and custom emojis
export function renderMarkdown(text: string, emojis: Record<string, string> = {}): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  const plain = (chunk: string, key: string) => renderEmojis(chunk, emojis, key);

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...plain(text.slice(lastIndex, match.index), `p${lastIndex}`));
    }

    if (match[2]) {
      parts.push(<strong key={match.index} className="font-bold">{plain(match[2], `b${match.index}`)}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} className="italic">{plain(match[3], `i${match.index}`)}</em>);
    } else if (match[4] && match[5]) {
      parts.push(
        <a
          key={match.index}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:opacity-80"
        >
          {plain(match[4], `l${match.index}`)}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...plain(text.slice(lastIndex), `p${lastIndex}`));
  }

  return parts.length > 0 ? parts : [text];
}
