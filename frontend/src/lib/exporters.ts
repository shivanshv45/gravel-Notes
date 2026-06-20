import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Note } from '../types';

// Handles downloading files to the user's machine.
// We create a temporary Blob URL, trigger a click on a hidden anchor, then clean up.

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Sanitize filenames so they don't break on the user's OS
function safeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'untitled';
}

// Export the raw markdown content as a .md file
export function exportAsMd(note: Note) {
  const filename = `${safeFilename(note.title)}.md`;
  downloadFile(filename, note.content, 'text/markdown;charset=utf-8');
}

// Export as plain text — we just strip the raw content as-is
export function exportAsTxt(note: Note) {
  const filename = `${safeFilename(note.title)}.txt`;
  downloadFile(filename, note.content, 'text/plain;charset=utf-8');
}

// Export as a self-contained HTML page with dark-themed styling baked in.
// This way the exported file looks good when opened in any browser.
export function exportAsHtml(note: Note) {
  // We need to render the markdown to HTML. We'll use a hidden container for this.
  const tempDiv = document.createElement('div');
  tempDiv.style.display = 'none';
  document.body.appendChild(tempDiv);

  // Build a simple but styled HTML document
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${note.title}</title>
  <style>
    body {
      background: #1e1e1e;
      color: #cccccc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
    }
    h1, h2, h3, h4, h5, h6 { color: #ffffff; margin-top: 1.5em; margin-bottom: 0.5em; }
    h1 { font-size: 2em; border-bottom: 1px solid #3e3e42; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #3e3e42; padding-bottom: 0.3em; }
    p { margin-bottom: 1em; }
    ul, ol { padding-left: 2em; margin-bottom: 1em; }
    code { background: rgba(255,255,255,0.1); padding: 0.2em 0.4em; border-radius: 3px; font-family: Consolas, monospace; }
    pre { background: #1a1a1a; padding: 1em; border-radius: 4px; overflow-x: auto; margin-bottom: 1em; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 3px solid #007acc; padding-left: 1em; color: #808080; margin-bottom: 1em; }
    a { color: #007acc; }
    table { border-collapse: collapse; margin-bottom: 1em; }
    th, td { border: 1px solid #3e3e42; padding: 8px 12px; }
    th { background: #2d2d2d; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #3e3e42; margin: 2em 0; }
  </style>
</head>
<body>
  <div id="content">${markdownToHtml(note.content)}</div>
</body>
</html>`;

  document.body.removeChild(tempDiv);

  const filename = `${safeFilename(note.title)}.html`;
  downloadFile(filename, htmlContent, 'text/html;charset=utf-8');
}

// Convert markdown to HTML using a simple approach.
// For the HTML export, we do a basic conversion. The live preview in the app uses ReactMarkdown.
function markdownToHtml(md: string): string {
  // This is a basic converter. For complex markdown, we rely on the live ReactMarkdown preview.
  // But for export, this covers the most common cases well enough.
  let html = md
    // Code blocks (must be before inline code)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Headers
    .replace(/^#{6}\s+(.*)$/gm, '<h6>$1</h6>')
    .replace(/^#{5}\s+(.*)$/gm, '<h5>$1</h5>')
    .replace(/^#{4}\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Blockquotes
    .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Unordered lists (basic single-level)
    .replace(/^[-*]\s+(.*)$/gm, '<li>$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Line breaks — double newline becomes paragraph
    .replace(/\n\n/g, '</p><p>')
    // Single newlines become <br> within paragraphs
    .replace(/\n/g, '<br>');

  // Wrap in paragraph tags
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

// Export as PDF using html2pdf.js.
// We render the markdown preview into a temporary off-screen element,
// let html2pdf capture it, then clean up.
export async function exportAsPdf(note: Note) {
  // Dynamic import so we don't bundle it if the user never exports to PDF
  const html2pdf = (await import('html2pdf.js')).default;

  // Build a temporary container with the rendered markdown
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: 800px; padding: 40px;
    background: white; color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6;
  `;
  container.innerHTML = `
    <style>
      h1, h2, h3, h4, h5, h6 { color: #1a1a1a; margin-top: 1em; margin-bottom: 0.5em; }
      h1 { font-size: 2em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.3em; }
      h2 { font-size: 1.5em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.3em; }
      p { margin-bottom: 1em; }
      ul, ol { padding-left: 2em; margin-bottom: 1em; }
      code { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; font-family: Consolas, monospace; font-size: 0.9em; }
      pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow-x: auto; margin-bottom: 1em; }
      pre code { background: transparent; padding: 0; }
      blockquote { border-left: 3px solid #007acc; padding-left: 1em; color: #666; margin-bottom: 1em; }
      table { border-collapse: collapse; margin-bottom: 1em; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; }
      th { background: #f0f0f0; }
    </style>
    ${markdownToHtml(note.content)}
  `;
  document.body.appendChild(container);

  const filename = `${safeFilename(note.title)}.pdf`;

  await html2pdf()
    .set({
      margin: 10,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    })
    .from(container)
    .save();

  document.body.removeChild(container);
}

// Re-export ReactMarkdown stuff so the Editor can use it without importing separately
export { ReactMarkdown, remarkGfm };
