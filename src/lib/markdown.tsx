import React from 'react';

// Simple markdown renderer for bold, italic, and links
export function renderMarkdown(text: string): React.ReactNode[] {
  // Process bold **text**, italic *text*, and links [text](url)
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(<strong key={match.index} className="font-bold">{match[2]}</strong>);
    } else if (match[3]) {
      // Italic
      parts.push(<em key={match.index} className="italic">{match[3]}</em>);
    } else if (match[4] && match[5]) {
      // Link
      parts.push(
        <a
          key={match.index}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:opacity-80"
        >
          {match[4]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
