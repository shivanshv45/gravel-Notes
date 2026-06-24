import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Share2 } from 'lucide-react';
import { shareNote, removeShare, getSharesForNote } from '../lib/cloudSync';
import type { NoteShare, ShareRole } from '../lib/cloudSync';

interface ShareModalProps {
  noteId: string;
  noteTitle: string;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ noteId, noteTitle, onClose }) => {
  const [shares, setShares] = useState<NoteShare[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('viewer');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadShares();
  }, [noteId]);

  const loadShares = async () => {
    const data = await getSharesForNote(noteId);
    setShares(data);
  };

  const handleShare = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setStatus(null);

    const { error } = await shareNote(noteId, email.trim().toLowerCase(), role);

    if (error) {
      setStatus(`Failed: ${error}`);
    } else {
      setStatus(`Shared with ${email.trim()}`);
      setEmail('');
      await loadShares();
    }
    setLoading(false);
  };

  const handleRemove = async (shareEmail: string) => {
    await removeShare(noteId, shareEmail);
    await loadShares();
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
  };

  const roleColors: Record<ShareRole, string> = {
    viewer: '#6495ed',
    commenter: '#e67e22',
    editor: '#4db6a0',
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={16} />
            Share "{noteTitle}"
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* add new share */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && handleShare()}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ShareRole)}
              style={{ ...inputStyle, width: '110px' }}
            >
              <option value="viewer">Viewer</option>
              <option value="commenter">Commenter</option>
              <option value="editor">Editor</option>
            </select>
            <button
              onClick={handleShare}
              disabled={loading || !email.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: 'var(--accent-color)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: loading ? 'wait' : 'pointer',
                opacity: !email.trim() ? 0.5 : 1,
              }}
            >
              <UserPlus size={14} />
            </button>
          </div>

          {status && (
            <p style={{ fontSize: '12px', color: status.startsWith('Failed') ? '#dc3c3c' : '#4db6a0' }}>
              {status}
            </p>
          )}

          {/* current shares */}
          {shares.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                People with access
              </span>
              {shares.map((share) => (
                <div
                  key={share.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg-app)',
                    borderRadius: '4px',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{share.shared_with_email}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '3px',
                      background: `${roleColors[share.role]}22`,
                      color: roleColors[share.role],
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>
                      {share.role}
                    </span>
                    <button
                      onClick={() => handleRemove(share.shared_with_email)}
                      style={{ display: 'flex', color: 'var(--text-muted)', padding: '2px' }}
                      title="Remove access"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {shares.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
              This note is private. Add someone above to share it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
