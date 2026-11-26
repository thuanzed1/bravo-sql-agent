import React, { useMemo } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

marked.setOptions({
  gfm: true,
  breaks: true
});

function cleanAndPreprocessContent(text: string): string {
  if (!text) return '';

  // Remove decorative emojis
  let processed = text.replace(/\uFE0F/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');

  // Block formula: $$...$$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, mathExpr) => {
    const trimmed = (mathExpr || '').trim();

    if (trimmed.includes('\\text{') || trimmed.includes('\\text {')) {
      const cleanFormula = trimmed
        .replace(/\\text\s*\{([^}]+)\}/g, '$1')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\le/g, '≤')
        .replace(/\\ge/g, '≥')
        .replace(/\\ne/g, '≠')
        .replace(/\\pm/g, '±')
        .trim();

      return `<div class="bravo-formula-callout"><span>${cleanFormula}</span></div>`;
    }

    try {
      return katex.renderToString(trimmed, {
        displayMode: true,
        throwOnError: false
      });
    } catch {
      return `<div class="bravo-formula-callout font-mono">${trimmed}</div>`;
    }
  });

  // Inline formula: $...$
  processed = processed.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_, mathExpr) => {
    const trimmed = (mathExpr || '').trim();

    if (trimmed.includes('\\text{') || trimmed.includes('\\text {')) {
      const cleanFormula = trimmed
        .replace(/\\text\s*\{([^}]+)\}/g, '$1')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .trim();
      return `<span class="bravo-inline-formula">${cleanFormula}</span>`;
    }

    try {
      return katex.renderToString(trimmed, {
        displayMode: false,
        throwOnError: false
      });
    } catch {
      return trimmed;
    }
  });

  return processed;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const htmlContent = useMemo(() => {
    if (!content) return '';
    try {
      const cleanText = cleanAndPreprocessContent(content);
      return marked.parse(cleanText) as string;
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className={`bravo-markdown-body leading-relaxed text-[13px] ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
