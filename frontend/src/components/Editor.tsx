import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Download, MessageSquarePlus, Trash2, Eye, Pencil, MessageCircle } from 'lucide-react';
import { exportAsMd, exportAsTxt, exportAsHtml, exportAsPdf } from '../lib/exporters';
import { fetchComments, addComment, deleteComment, subscribeToComments } from '../lib/cloudSync';
import { useAuth } from '../contexts/AuthContext';
import type { Note, NoteRole, NoteComment } from '../types';

interface EditorProps {
  note: Note;
  onChange: (content: string) => void;
  showPreview: boolean;
  role: NoteRole;
}

const COMMENT_COLORS = ['#6495ed', '#e67e22', '#4db6a0', '#dc3c3c', '#8e44ad', '#f1c40f'];

export const Editor: React.FC<EditorProps> = ({ note, onChange, showPreview, role }) => {
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localContent, setLocalContent] = useState(note.content);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // comment state
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentLine, setCommentLine] = useState(1);
  const [commentText, setCommentText] = useState('');
  const [commentColor, setCommentColor] = useState(COMMENT_COLORS[0]);
  const [commentError, setCommentError] = useState('');
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);

  // undo/redo
  const historyRef = useRef<string[]>([note.content]);
  const pointerRef = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReadOnly = role === 'viewer' || role === 'commenter';
  const canComment = role === 'commenter' || role === 'editor' || role === 'owner';

  // sync external changes into local state
  useEffect(() => {
    if (note.content !== localContent) {
      setLocalContent(note.content);
      historyRef.current = [note.content];
      pointerRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.content]);

  // load comments
  useEffect(() => {
    if (!user) return;
    fetchComments(note.id).then(setComments);
    const unsub = subscribeToComments(note.id, () => {
      fetchComments(note.id).then(setComments);
    });
    return unsub;
  }, [note.id, user]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const newVal = e.target.value;
    setLocalContent(newVal);
    onChange(newVal);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      const history = historyRef.current;
      const pointer = pointerRef.current;
      if (pointer < history.length - 1) {
        historyRef.current = history.slice(0, pointer + 1);
      }
      if (historyRef.current[historyRef.current.length - 1] !== newVal) {
        historyRef.current.push(newVal);
        if (historyRef.current.length > 100) {
          historyRef.current.shift();
        } else {
          pointerRef.current = historyRef.current.length - 1;
        }
      }
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (isCtrl && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    }
  };

  const undo = () => {
    if (pointerRef.current > 0) {
      pointerRef.current -= 1;
      const val = historyRef.current[pointerRef.current];
      setLocalContent(val);
      onChange(val);
    }
  };

  const redo = () => {
    if (pointerRef.current < historyRef.current.length - 1) {
      pointerRef.current += 1;
      const val = historyRef.current[pointerRef.current];
      setLocalContent(val);
      onChange(val);
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

  // get current cursor line number
  const getCursorLine = (): number => {
    const ta = textareaRef.current;
    if (!ta) return 1;
    const text = ta.value.substring(0, ta.selectionStart);
    return text.split('\n').length;
  };

  const handleAddComment = async () => {
    if (!user?.email || !commentText.trim()) return;
    setCommentError('');
    const { error } = await addComment(note.id, user.email, commentLine, commentText.trim(), commentColor);
    if (error) {
      setCommentError(error);
    } else {
      setCommentText('');
      setShowCommentForm(false);
      await fetchComments(note.id).then(setComments);
    }
  };

  const handleDeleteComment = async (id: string) => {
    await deleteComment(id);
    setComments(prev => prev.filter(c => c.id !== id));
    setExpandedCommentId(null);
  };

  const openCommentAtCursor = () => {
    setCommentLine(getCursorLine());
    setShowCommentForm(true);
    setCommentError('');
  };

  // role badge
  const roleBadge = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px',
      borderRadius: '4px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px',
      border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-muted)',
      position: 'absolute' as const, bottom: '16px', right: '16px', zIndex: 10,
    }}>
      {role === 'viewer' ? <Eye size={12} /> : role === 'commenter' ? <MessageCircle size={12} /> : <Pencil size={12} />}
      {role === 'owner' ? 'Editor (Owner)' : role}
    </div>
  );

  // comment markers on the side
  const lineCommentMap = new Map<number, NoteComment[]>();
  comments.forEach(c => {
    const arr = lineCommentMap.get(c.line_number) || [];
    arr.push(c);
    lineCommentMap.set(c.line_number, arr);
  });

  return (
    <div className="editor-content" style={{ position: 'relative' }}>
      {roleBadge}

      {/* comment add button for commenters */}
      {canComment && user && (
        <button
          onClick={openCommentAtCursor}
          title="Add comment at cursor"
          style={{
            position: 'absolute', top: '20px', right: showPreview ? 'calc(50% + 20px)' : '20px', zIndex: 10,
            padding: '6px 10px', background: 'var(--bg-app)', border: '1px solid var(--border-color)',
            borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', color: 'var(--text-primary)', cursor: 'pointer',
          }}
        >
          <MessageSquarePlus size={14} /> Comment
        </button>
      )}

      <div className={`editor-split ${!showPreview ? 'single-pane' : ''}`}>
        {/* textarea + comment gutter */}
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          {/* comment gutter */}
          {comments.length > 0 && (
            <div style={{ width: '28px', flexShrink: 0, position: 'relative', paddingTop: '0' }}>
              {Array.from(lineCommentMap.entries()).map(([line, cmts]) => (
                <div
                  key={line}
                  onClick={() => setExpandedCommentId(expandedCommentId === cmts[0].id ? null : cmts[0].id)}
                  title={`${cmts.length} comment(s) on line ${line}`}
                  style={{
                    position: 'absolute',
                    top: `${(line - 1) * 1.7 * 14 + 6}px`,
                    left: '8px',
                    width: '4px', height: '12px', borderRadius: '2px',
                    background: cmts[0].color,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={localContent}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            readOnly={isReadOnly}
            placeholder={isReadOnly ? 'You have view-only access to this note.' : 'Start writing... (Markdown is supported)'}
            spellCheck="false"
            style={{
              cursor: isReadOnly ? 'default' : undefined,
              opacity: isReadOnly ? 0.85 : 1,
              borderRight: showPreview ? '1px solid var(--border-color)' : 'none',
            }}
          />
        </div>

        {showPreview && (
          <div className="editor-preview" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '20px', right: '30px', zIndex: 10 }}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                style={{
                  padding: '6px', background: 'var(--bg-menu)', borderRadius: '4px',
                  border: '1px solid var(--border-color)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
                title="Export Note"
              >
                <Download size={16} />
              </button>
              {showExportMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, background: 'var(--bg-menu)',
                  border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px',
                  minWidth: '120px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                  display: 'flex', flexDirection: 'column', padding: '4px 0',
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

      {/* expanded comment popover */}
      {expandedCommentId && (() => {
        const c = comments.find(x => x.id === expandedCommentId);
        if (!c) return null;
        return (
          <div style={{
            position: 'absolute', top: `${(c.line_number - 1) * 1.7 * 14 + 30}px`, left: '40px',
            background: 'var(--bg-sidebar)', border: `1px solid ${c.color}`, borderRadius: '8px',
            padding: '12px 14px', maxWidth: '320px', minWidth: '200px', zIndex: 50,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: c.color, fontWeight: 600 }}>{c.user_email}</span>
              {user?.email === c.user_email && (
                <button onClick={() => handleDeleteComment(c.id)} style={{ color: 'var(--text-muted)', padding: '2px' }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{c.content}</p>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>Line {c.line_number}</span>
            <button
              onClick={() => setExpandedCommentId(null)}
              style={{ position: 'absolute', top: '6px', right: '8px', fontSize: '14px', color: 'var(--text-muted)', cursor: 'pointer' }}
            >×</button>
          </div>
        );
      })()}

      {/* comment form popover */}
      {showCommentForm && (
        <div style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '10px',
          padding: '16px', width: '340px', zIndex: 100, boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-highlight)' }}>Add Comment (Line {commentLine})</span>
            <button onClick={() => setShowCommentForm(false)} style={{ color: 'var(--text-muted)', fontSize: '16px' }}>×</button>
          </div>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
            placeholder="Your comment..."
            maxLength={500}
            style={{
              width: '100%', height: '70px', resize: 'none',
              padding: '8px', background: 'var(--bg-app)', color: 'var(--text-primary)',
              border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
            {COMMENT_COLORS.map(c => (
              <div
                key={c}
                onClick={() => setCommentColor(c)}
                style={{
                  width: '22px', height: '22px', borderRadius: '50%', background: c, cursor: 'pointer',
                  border: commentColor === c ? '2px solid var(--text-highlight)' : '2px solid transparent',
                  transition: 'border-color 0.15s',
                }}
              />
            ))}
          </div>
          {commentError && <p style={{ color: '#dc3c3c', fontSize: '12px', marginTop: '6px' }}>{commentError}</p>}
          <button
            onClick={handleAddComment}
            disabled={!commentText.trim()}
            style={{
              width: '100%', marginTop: '10px', padding: '8px', background: commentColor,
              color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              cursor: commentText.trim() ? 'pointer' : 'default', opacity: commentText.trim() ? 1 : 0.5,
            }}
          >
            Post Comment
          </button>
        </div>
      )}
    </div>
  );
};
