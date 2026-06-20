import React from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  type: 'markdown-guide' | 'about';
  onClose: () => void;
}

// Modal overlay for Help content.
// "markdown-guide" shows a cheat sheet of markdown syntax.
// "about" shows a brief description of the app.
export const HelpModal: React.FC<HelpModalProps> = ({ type, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{type === 'markdown-guide' ? 'Markdown Guide' : 'About Gravel'}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          {type === 'markdown-guide' ? <MarkdownGuide /> : <AboutContent />}
        </div>
      </div>
    </div>
  );
};

// Comprehensive markdown formatting reference.
// Each row shows the syntax you type on the left and what it produces on the right.
function MarkdownGuide() {
  const entries = [
    { syntax: '# Heading 1', description: 'Top-level heading' },
    { syntax: '## Heading 2', description: 'Second-level heading' },
    { syntax: '### Heading 3', description: 'Third-level heading' },
    { syntax: '**bold text**', description: 'Bold text' },
    { syntax: '*italic text*', description: 'Italic text' },
    { syntax: '***bold and italic***', description: 'Bold and italic' },
    { syntax: '~~strikethrough~~', description: 'Strikethrough text' },
    { syntax: '`inline code`', description: 'Inline code' },
    { syntax: '```\ncode block\n```', description: 'Fenced code block' },
    { syntax: '> blockquote', description: 'Blockquote' },
    { syntax: '- item', description: 'Unordered list item' },
    { syntax: '1. item', description: 'Ordered list item' },
    { syntax: '[link text](url)', description: 'Hyperlink' },
    { syntax: '![alt text](image-url)', description: 'Image' },
    { syntax: '---', description: 'Horizontal rule' },
    { syntax: '| Col1 | Col2 |', description: 'Table (GFM)' },
    { syntax: '- [ ] task', description: 'Task list (unchecked)' },
    { syntax: '- [x] task', description: 'Task list (checked)' },
  ];

  return (
    <div className="markdown-guide-content">
      <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
        Type these patterns in the editor. The preview pane will render them in real time.
      </p>
      <table className="guide-table">
        <thead>
          <tr>
            <th>What you type</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={i}>
              <td><code>{entry.syntax}</code></td>
              <td>{entry.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AboutContent() {
  return (
    <div>
      <p><strong>Gravel</strong> is a minimalist, browser-based markdown editor.</p>
      <p style={{ marginTop: '12px' }}>
        Inspired by Obsidian and Photopea — it's designed for people who want to start writing
        immediately without signing up, installing anything, or dealing with unnecessary complexity.
      </p>
      <p style={{ marginTop: '12px' }}>
        All your notes are saved locally in your browser using IndexedDB.
        Nothing leaves your machine unless you choose to export.
      </p>
      <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>
        Export formats: .md, .txt, .html, .pdf
      </p>
    </div>
  );
}
