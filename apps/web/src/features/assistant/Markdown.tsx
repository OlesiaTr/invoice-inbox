import { Fragment, type ReactNode } from 'react';

/**
 * Tiny markdown subset for chat replies: paragraphs, "- " lists, **bold** and `code`.
 * Builds React elements (never innerHTML), so model output can't inject markup.
 */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-0.5 pl-5">
          {list.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const line of text.split('\n')) {
    const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (item) {
      list.push(item[1]);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={i} className="rounded bg-muted px-1 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}
