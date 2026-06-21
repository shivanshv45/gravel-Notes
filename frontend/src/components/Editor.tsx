import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Download } from 'lucide-react';
import { exportAsMd, exportAsTxt, exportAsHtml, exportAsPdf } from '../lib/exporters';
import type { Note } from '../types';

interface EditorProps {
  note: Note;
  onChange: (content: string) => void;
  showPreview: boolean;
}

export const Editor: React.FC<EditorProps> = ({ note, onChange, showPreview }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // We maintain a local state to keep the textarea fully controlled without relying on the parent's
  // async state updates, which helps keep the cursor position stable.
  const [localContent, setLocalContent] = useState(note.content);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // ─── Custom Logical Undo/Redo Stack ───
  // The browser's native undo stack is easily broken in React. We build a custom one that
  // takes a snapshot of the text every time the user pauses typing for 500ms.
  const historyRef = useRef<string[]>([note.content]);
  const pointerRef = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external changes (like restoring a version history snapshot) into our local state
  useEffect(() => {
    if (note.content !== localContent) {
      // It's an external update
      setLocalContent(note.content);
      // Reset the undo stack for this external change
      historyRef.current = [note.content];
      pointerRef.current = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.content]); 
  // We explicitly DO NOT include localContent in the dependency array to prevent infinite loops

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setLocalContent(newVal);
    onChange(newVal); // bubble up to App.tsx for persistence

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Save a history snapshot after 500ms of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      const history = historyRef.current;
      const pointer = pointerRef.current;

      // If we made new edits after undoing, truncate the "future" redo steps
      if (pointer < history.length - 1) {
        historyRef.current = history.slice(0, pointer + 1);
      }
      
      // Only push if it's actually different
      if (historyRef.current[historyRef.current.length - 1] !== newVal) {
        historyRef.current.push(newVal);
        
        // Prevent infinite memory growth: max 100 undo steps
        if (historyRef.current.length > 100) {
          historyRef.current.shift();
        } else {
          pointerRef.current = historyRef.current.length - 1;
        }
      }
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isCtrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (isShift) {
        // Redo (Ctrl+Shift+Z)
        redo();
      } else {
        // Undo (Ctrl+Z)
        undo();
      }
    } else if (isCtrl && e.key.toLowerCase() === 'y') {
      // Redo (Ctrl+Y)
      e.preventDefault();
      redo();
    }
  };

  const undo = () => {
    if (pointerRef.current > 0) {
      pointerRef.current -= 1;
      const prevVal = historyRef.current[pointerRef.current];
      setLocalContent(prevVal);
      onChange(prevVal);
    }
  };

  const redo = () => {
    if (pointerRef.current < historyRef.current.length - 1) {
      pointerRef.current += 1;
      const nextVal = historyRef.current[pointerRef.current];
      setLocalContent(nextVal);
      onChange(nextVal);
    }
  };

  useEffect(() => {
    const handleUndo = () => undo();
    const handleRedo = () => redo();
    window.addEventListener('app-undo', handleUndo);
    window.addEventListener('app-redo', handleRedo);
    return () => {
      window.removeEventListener('app-undo', handleUndo);
      window.removeEventListener('app-redo', handleRedo);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="editor-content">
      <div className={`editor-split ${!showPreview ? 'single-pane' : ''}`}>
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={localContent}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Start writing... (Markdown is supported)"
          spellCheck="false"
        />
        {showPreview && (
          <div className="editor-preview" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '20px', right: '30px', zIndex: 10 }}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                style={{
                  padding: '6px',
                  background: 'var(--bg-menu)',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Export Note"
              >
                <Download size={16} />
              </button>
              {showExportMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'var(--bg-menu)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  marginTop: '4px',
                  minWidth: '120px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '4px 0'
                }}>
                  <div className="dropdown-item" onClick={() => { exportAsMd(note); setShowExportMenu(false); }}>.md</div>
                  <div className="dropdown-item" onClick={() => { exportAsTxt(note); setShowExportMenu(false); }}>.txt</div>
                  <div className="dropdown-item" onClick={() => { exportAsHtml(note); setShowExportMenu(false); }}>.html</div>
                  <div className="dropdown-item" onClick={() => { exportAsPdf(note); setShowExportMenu(false); }}>.pdf</div>
                </div>
              )}
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {localContent || '*No content yet*'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
