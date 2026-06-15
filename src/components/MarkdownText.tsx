import React from 'react';

interface MarkdownTextProps {
  content: string;
}

type InlinePart = string | React.ReactElement;

const STRUCTURED_MARKDOWN_PATTERN = /(^|\n)\s*(#{1,6}\s|[-*]\s|\d+[.、]\s|[①②③④⑤⑥⑦⑧⑨⑩])/;
const PARAGRAPH_START_PATTERN =
  /(从(?:月份|时间|资源|任务|数据|整体|分布|类型|阶段|维度)[^，。；;]{0,10}(?:看|来看|上)|(?:资源类型|任务类型|整体|总体|其中|此外|同时|另一方面|这半年|本月|本周|本季度|下一步|建议|风险|亮点|问题|结论)(?:上|来看|看)?)/g;

function normalizePlainText(content: string) {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ');
}

function splitSentences(text: string): string[] {
  const sentences = text.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [text];
  return sentences.map((sentence) => sentence.trim()).filter(Boolean);
}

function isParagraphStarter(text: string) {
  PARAGRAPH_START_PATTERN.lastIndex = 0;
  return PARAGRAPH_START_PATTERN.test(text);
}

function groupSentences(sentences: string[]): string[] {
  const groups: string[] = [];
  let current = '';

  sentences.forEach((sentence, index) => {
    const next = current ? `${current}${sentence}` : sentence;
    const nextSentence = sentences[index + 1] || '';
    const shouldBreak =
      next.length >= 72 ||
      isParagraphStarter(nextSentence) ||
      index === sentences.length - 1;

    if (shouldBreak) {
      groups.push(next);
      current = '';
    } else {
      current = next;
    }
  });

  if (current) groups.push(current);
  return groups;
}

function autoParagraphPlainText(content: string) {
  const normalized = normalizePlainText(content).trim();
  if (!normalized || STRUCTURED_MARKDOWN_PATTERN.test(normalized) || /\n\s*\n/.test(normalized)) {
    return normalized;
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines.join('\n\n');
  }

  if (normalized.length < 110) return normalized;
  return groupSentences(splitSentences(normalized)).join('\n\n');
}

function normalizeBracketSections(content: string) {
  const contentWithLineBreaks = autoParagraphPlainText(content);
  const hasBracketSections = /【[^】]+】/.test(contentWithLineBreaks);
  if (!hasBracketSections) {
    return {
      content: contentWithLineBreaks,
      hasBracketSections,
    };
  }

  return {
    hasBracketSections,
    content: contentWithLineBreaks
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
