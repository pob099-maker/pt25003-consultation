import type { ReactNode } from 'react';

/**
 * Renders the small, closed subset of Markdown that this project's own
 * generators emit — headings, bullets, block quotes, and inline bold, italic
 * and code. It is not a general Markdown parser and is not meant to become
 * one: the input is written a few files away, so the grammar is fixed and can
 * be relied on.
 *
 * It exists so the phone script can be read on screen during a call rather
 * than only downloaded, without a second copy of the script's structure that
 * could drift from the first.
 */

const INLINE = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g;

const inline = (text: string, keyPrefix: string): ReactNode[] =>
  text
    .split(INLINE)
    .filter((part) => part.length > 0)
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={key} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return (
          <em key={key} className="text-ink-soft">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={key} className="rounded bg-sunk px-1 py-0.5 text-meta">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={key}>{part}</span>;
    });

const HEADING_CLASS: Readonly<Record<number, string>> = {
  1: 'mt-0 mb-3 text-title font-bold',
  2: 'mt-8 mb-2 border-t border-line pt-5 text-title font-bold',
  3: 'mt-6 mb-2 text-subtitle font-semibold',
  4: 'mt-5 mb-2 text-body font-semibold',
};

export const MarkdownView = ({ source }: { source: string }) => {
  const blocks: ReactNode[] = [];
  const lines = source.split('\n');
  let bullets: string[] = [];

  const flushBullets = (key: string): void => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={key} className="my-2 grid gap-1 pl-5">
        {bullets.map((item, index) => (
          <li key={`${key}-${index}`} className="list-disc text-ink">
            {inline(item, `${key}-${index}`)}
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const key = `line-${index}`;

    if (line.trimStart().startsWith('- ')) {
      bullets.push(line.trimStart().slice(2));
      return;
    }
    flushBullets(`bullets-${index}`);

    if (line.trim().length === 0) return;

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading !== null) {
      const level = heading[1]?.length ?? 1;
      const text = heading[2] ?? '';
      const Tag = (level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
      blocks.push(
        <Tag key={key} className={HEADING_CLASS[level] ?? HEADING_CLASS[4]}>
          {text}
        </Tag>,
      );
      return;
    }

    if (line.startsWith('> ')) {
      blocks.push(
        <blockquote key={key} className="my-3 border-l-4 border-accent pl-4 text-ink">
          {inline(line.slice(2), key)}
        </blockquote>,
      );
      return;
    }

    if (line.trim() === '---') {
      blocks.push(<hr key={key} className="my-6 border-line" />);
      return;
    }

    blocks.push(
      <p key={key} className="my-2 text-ink">
        {inline(line, key)}
      </p>,
    );
  });

  flushBullets('bullets-end');

  return <div className="text-body">{blocks}</div>;
};
