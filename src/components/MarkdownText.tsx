import React from 'react';
import { TextDisplayMode, TextSize } from '../types';

interface MarkdownTextProps {
  content: string;
  displayMode?: TextDisplayMode;
  textSize?: TextSize;
}

type InlinePart = string | React.ReactElement;

const SECTION_TITLE_PATTERN = /^(.{2,18})([:：])\s*(.+)$/;
const SENTENCE_PATTERN = /[^。！？!?；;]+[。！？!?；;]?/g;

function normalizeLineBreaks(content: string) {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function splitLongParagraph(text: string, maxLength = 72) {
  const sentences = text.match(SENTENCE_PATTERN)?.map((sentence) => sentence.trim()).filter(Boolean) || [text];
  const paragraphs: string[] = [];
  let current = '';

  sentences.forEach((sentence) => {
    const next = current ? `${current}${sentence}` : sentence;
    if (current && next.length > maxLength) {
      paragraphs.push(current);
      current = sentence;
      return;
    }
    current = next;
  });

  if (current) paragraphs.push(current);
  return paragraphs.length ? paragraphs : [text];
}

function expandSectionLine(line: string, forceSection: boolean) {
  const trimmed = line.trim();
  const match = trimmed.match(SECTION_TITLE_PATTERN);
  if (!match) return [line];

  const [, title, , body] = match;
  const shouldSplit = forceSection || /^[一二三四五六七八九十\d.、（）()A-Za-z\s-]*[\u4e00-\u9fa5]{2,}$/.test(title);
  return shouldSplit ? [`### ${title.trim()}`, body.trim()] : [line];
}

function normalizeBracketSections(content: string, displayMode: TextDisplayMode) {
  const contentWithLineBreaks = normalizeLineBreaks(content);
  const hasBracketSections = /【[^】]+】/.test(contentWithLineBreaks);
  const hasMarkdownHeadings = /^#{1,3}\s+/m.test(contentWithLineBreaks);
  const forceSection = displayMode === 'section';

  if (!hasBracketSections && !forceSection) {
    const normalizedLines = contentWithLineBreaks
      .split('\n')
      .flatMap((line) => expandSectionLine(line, false))
      .flatMap((line) => {
        if (displayMode !== 'auto') return [line];
        const trimmed = line.trim();
        if (!trimmed || /^#{1,3}\s+/.test(trimmed) || /^[-*]\s+/.test(trimmed)) return [line];
        if (contentWithLineBreaks.includes('\n') && trimmed.length <= 56) return [line];
        return splitLongParagraph(trimmed);
      })
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      content: normalizedLines,
      hasBracketSections,
      hasMarkdownHeadings,
    };
  }

  return {
    hasBracketSections,
    hasMarkdownHeadings,
    content: contentWithLineBreaks
      .replace(/\s*【([^】]+)】\s*/g, '\n\n### $1\n')
      .split('\n')
      .flatMap((line) => expandSectionLine(line, forceSection))
      .flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed || /^#{1,3}\s+/.test(trimmed) || /^[-*]\s+/.test(trimmed)) return [line];
        return displayMode === 'preserve' ? [line] : splitLongParagraph(trimmed, 84);
      })
      .join('\n\n')
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

export function MarkdownText({ content, displayMode = 'auto', textSize = 'medium' }: MarkdownTextProps) {
  const normalized = normalizeBracketSections(content, displayMode);
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

    if ((normalized.hasBracketSections || normalized.hasMarkdownHeadings) && !hasRenderedHeading) {
      nodes.push(<h2 key={key}>{renderInline(trimmed)}</h2>);
      hasRenderedHeading = true;
      return;
    }

    nodes.push(<p key={key}>{renderInline(trimmed)}</p>);
  });

  flushList('last-list');

  return <article className={`markdown-text text-size-${textSize}`}>{nodes}</article>;
}
