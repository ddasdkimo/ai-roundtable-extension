// Lightweight Markdown renderer (pure JS, no dependencies)
// Security: HTML is escaped BEFORE markdown transformation to prevent XSS

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a markdown string to safe HTML.
 * @param {string} raw - raw markdown text
 * @returns {string} sanitized HTML string
 */
export function renderMarkdown(raw) {
  if (!raw) return '';

  // 1. Escape all HTML first (XSS protection)
  let text = escapeHtml(raw);

  // 2. Fenced code blocks (``` ... ```)
  //    Must be processed before line-level rules
  text = text.replace(
    /^```(?:([a-zA-Z0-9_+-]*))?\n([\s\S]*?)^```/gm,
    (_match, lang, code) => {
      const cls = lang ? ` class="language-${lang}"` : '';
      return `<pre class="md-code-block"><code${cls}>${code.replace(/\n$/, '')}</code></pre>`;
    }
  );

  // Process remaining text line-by-line (skip pre blocks)
  const parts = text.split(/(<pre class="md-code-block">[\s\S]*?<\/pre>)/g);

  text = parts
    .map((part) => {
      // Don't touch code block parts
      if (part.startsWith('<pre class="md-code-block">')) return part;

      let lines = part.split('\n');
      let result = [];
      let inList = false;
      let listType = null; // 'ul' or 'ol'

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Blockquote: > text
        if (/^&gt;\s?(.*)$/.test(line)) {
          const content = line.replace(/^&gt;\s?/, '');
          result.push(`<blockquote class="md-blockquote">${inlineFormat(content)}</blockquote>`);
          continue;
        }

        // Headings: #, ##, ###
        const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
          closeList();
          const level = headingMatch[1].length;
          result.push(`<h${level} class="md-heading md-h${level}">${inlineFormat(headingMatch[2])}</h${level}>`);
          continue;
        }

        // Unordered list: - item
        if (/^[-*]\s+(.+)$/.test(line)) {
          const content = line.replace(/^[-*]\s+/, '');
          if (!inList || listType !== 'ul') {
            closeList();
            inList = true;
            listType = 'ul';
            result.push('<ul class="md-list">');
          }
          result.push(`<li>${inlineFormat(content)}</li>`);
          continue;
        }

        // Ordered list: 1. item
        if (/^\d+\.\s+(.+)$/.test(line)) {
          const content = line.replace(/^\d+\.\s+/, '');
          if (!inList || listType !== 'ol') {
            closeList();
            inList = true;
            listType = 'ol';
            result.push('<ol class="md-list">');
          }
          result.push(`<li>${inlineFormat(content)}</li>`);
          continue;
        }

        // Regular line
        closeList();
        result.push(inlineFormat(line));
      }

      closeList();
      return result.join('\n');

      function closeList() {
        if (inList) {
          result.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
          listType = null;
        }
      }
    })
    .join('');

  return text;
}

/**
 * Apply inline formatting: bold, inline code
 */
function inlineFormat(text) {
  // Inline code: `code` (process first to protect content inside)
  text = text.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
  // Bold: **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return text;
}
