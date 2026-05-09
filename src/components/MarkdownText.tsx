import React from 'react';

interface MarkdownTextProps {
  content: string;
}

type InlinePart = string | React.ReactElement;

function normalizeBracketSections(content: string) {
  const hasBracketSections = /【[^】]+】/.test(content);
  if (!hasBracketSections) {
    return {
      content,
      hasBracketSections,
    };
  }

  return {
    hasBracketSections,
    content: content
      .replace(/\s*【([^】]+)】\s*/g, '\n\n### $1\n')
      .replace(/([。！？!?])\s*/g, '$1\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  };
}

function renderInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={`${match.index}-${match[1]}`}>{match[1]}</strong>);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function MarkdownText({ content }: MarkdownTextProps) {
  const normalized = normalizeBracketSections(content);
  const lines = normalized.content.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let hasRenderedHeading = false;

  function flushList(key: string) {
    if (!listItems.length) return;
    nodes.push(
      <ul key={key}>
        {listItems.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const key = `line-${index}`;

    if (!trimmed) {
      flushList(`${key}-list`);
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2).trim());
      return;
    }

    flushList(`${key}-list`);

    if (trimmed.startsWith('### ')) {
      nodes.push(<h3 key={key}>{renderInline(trimmed.slice(4))}</h3>);
      hasRenderedHeading = true;
      return;
    }

    if (trimmed.startsWith('## ')) {
      nodes.push(<h2 key={key}>{renderInline(trimmed.slice(3))}</h2>);
      hasRenderedHeading = true;
      return;
    }

    if (trimmed.startsWith('# ')) {
      nodes.push(<h1 key={key}>{renderInline(trimmed.slice(2))}</h1>);
      hasRenderedHeading = true;
      return;
    }

    if (normalized.hasBracketSections && !hasRenderedHeading) {
      nodes.push(<h2 key={key}>{renderInline(trimmed)}</h2>);
      hasRenderedHeading = true;
      return;
    }

    nodes.push(<p key={key}>{renderInline(trimmed)}</p>);
  });

  flushList('last-list');

  return <article className="markdown-text">{nodes}</article>;
}
