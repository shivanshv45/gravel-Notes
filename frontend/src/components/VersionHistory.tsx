import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Clock } from 'lucide-react';
import type { NoteVersion } from '../types';
import { getVersionsForNote } from '../lib/storage';

// Version History panel — shows the last 10 auto-saved snapshots for the active note.
// The user can preview any version and restore it with one click.
// Each snapshot is taken every 60 seconds if the content has changed.

interface VersionHistoryProps {
  noteId: string;
  noteTitle: string;
  onRestore: (content: string, title: string) => void;
  onClose: () => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  noteId,
  noteTitle,
  onRestore,
  onClose,
}) => {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    getVersionsForNote(noteId).then(setVersions);
  }, [noteId]);

  // Format a timestamp into something readable like "2 minutes ago" or "Today at 3:45 PM"
  const formatTime = (ts: number) => {
    const now = Date.now();
    const diff = now - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const selectedVersion = selectedIdx !== null ? versions[selectedIdx] : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="version-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Version History — {noteTitle}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="version-history-body">
          {/* Left: list of versions */}
          <div className="version-list">
            {versions.length === 0 ? (
              <div className="version-empty">
                <Clock size={20} />
                <span>No snapshots yet. Versions are saved automatically every minute.</span>
              </div>
            ) : (
              versions.map((v, idx) => (
                <div
                  key={v.timestamp}
                  className={`version-item ${selectedIdx === idx ? 'active' : ''}`}
                  onClick={() => setSelectedIdx(idx)}
                >
                  <div className="version-item-time">{formatTime(v.timestamp)}</div>
                  <div className="version-item-preview">
                    {v.content.slice(0, 80) || '(empty)'}
                    {v.content.length > 80 ? '...' : ''}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: preview of the selected version */}
          <div className="version-preview">
            {selectedVersion ? (
              <>
                <div className="version-preview-header">
                  <span>{formatTime(selectedVersion.timestamp)}</span>
                  <button
                    className="version-restore-btn"
                    onClick={() => {
                      if (window.confirm('Restore this version? Your current content will be replaced.')) {
                        onRestore(selectedVersion.content, selectedVersion.title);
                        onClose();
                      }
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>Restore this version</span>
                  </button>
                </div>
                <pre className="version-preview-content">{selectedVersion.content}</pre>
              </>
            ) : (
              <div className="version-preview-empty">
                Select a version from the list to preview it.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
