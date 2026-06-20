import React from 'react';
import type { Note } from '../types';
import { X, FileText } from 'lucide-react';

interface TabBarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

// Tab bar sitting above the editor, modeled after Obsidian's tab system.
// Each open note gets its own tab. Clicking the X closes (deletes) the note.
export const TabBar: React.FC<TabBarProps> = ({ notes, activeNoteId, onSelectTab, onCloseTab }) => {
  // Don't render anything if there are no notes open
  if (notes.length === 0) return null;

  return (
    <div className="tab-bar">
      {notes.map((note) => (
        <div
          key={note.id}
          className={`tab ${note.id === activeNoteId ? 'active' : ''}`}
          onClick={() => onSelectTab(note.id)}
          title={note.title || 'Untitled Note'}
        >
          <FileText size={14} style={{ opacity: 0.7, flexShrink: 0 }} />
          <span className="tab-title">{note.title || 'Untitled Note'}</span>
          <div
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation(); // Prevent switching to the tab we're closing
              onCloseTab(note.id);
            }}
          >
            <X size={12} />
          </div>
        </div>
      ))}
    </div>
  );
};
