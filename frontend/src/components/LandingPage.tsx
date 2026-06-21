import React, { useState } from 'react';
import {
  FilePlus,
  FolderOpen,
  Home,
  HardDrive,
  Files,
  BookOpen,
  FileText,
  FileCode,
  FileType,
  FileDown,
} from 'lucide-react';

interface LandingPageProps {
  onNewNote: () => void;
  onOpenFile: () => void;
  onShowMarkdownGuide: () => void;
  allNotes: { id: string; title: string }[];
  onOpenNote: (id: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNewNote,
  onOpenFile,
  onShowMarkdownGuide,
  allNotes,
  onOpenNote,
}) => {
  const [activeSidebarItem, setActiveSidebarItem] = useState('Home');

  const sidebarItems = [
    { label: 'Home', icon: <Home size={16} /> },
    { label: 'All Notes', icon: <Files size={16} /> },
    { label: 'This Device', icon: <HardDrive size={16} /> },
    { label: 'Markdown Guide', icon: <BookOpen size={16} /> },
  ];

  // When "All Notes" is active, we show the full note list in the center
  // instead of the default home content
  const showAllNotes = activeSidebarItem === 'All Notes';

  return (
    <div className="landing-layout">
      {/* ─── Left Sidebar ─── */}
      <div className="landing-sidebar">
        {sidebarItems.map((item) => (
          <div
            key={item.label}
            className={`landing-sidebar-item ${activeSidebarItem === item.label ? 'active' : ''}`}
            onClick={() => {
              setActiveSidebarItem(item.label);
              if (item.label === 'This Device') onOpenFile();
              if (item.label === 'Markdown Guide') onShowMarkdownGuide();
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ─── Main Content Area ─── */}
      <div className="landing-main">
        <div className="landing-center">
          {/* Logo and app name — always shown */}
          <div className="landing-branding">
            <div className="landing-logo-icon">
              <img src="/imagev2.webp" alt="Gravel Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '18px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
            </div>
            <h1 className="landing-app-name">Gravel</h1>
          </div>

          {showAllNotes ? (
            // "All Notes" view — a full list of every note in IndexedDB
            <div className="landing-all-notes">
              <div className="landing-all-notes-header">
                <span>All Notes ({allNotes.length})</span>
                <button className="landing-btn" onClick={onNewNote} style={{ padding: '6px 14px' }}>
                  <FilePlus size={14} />
                  <span>New</span>
                </button>
              </div>
              {allNotes.length === 0 ? (
                <div className="landing-all-notes-empty">
                  No notes yet. Create one to get started.
                </div>
              ) : (
                <div className="landing-all-notes-list">
                  {allNotes.map((note) => (
                    <div
                      key={note.id}
                      className="landing-recent-item"
                      onClick={() => onOpenNote(note.id)}
                    >
                      <FileText size={14} />
                      <span>{note.title || 'Untitled Note'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Default "Home" view — action buttons, drop zone, recent notes, format icons
            <>
              <div className="landing-actions">
                <button className="landing-btn" onClick={onNewNote}>
                  <FilePlus size={16} />
                  <span>New Note</span>
                </button>
                <button className="landing-btn" onClick={onOpenFile}>
                  <FolderOpen size={16} />
                  <span>Open From Computer</span>
                </button>
                <button className="landing-btn" onClick={onShowMarkdownGuide}>
                  <BookOpen size={16} />
                  <span>Markdown Guide</span>
                </button>
              </div>

              <div className="landing-dropzone">
                <span>Drop any files here</span>
              </div>

              {/* Recent notes shown inline in the center — makes more sense here than the sidebar */}
              {allNotes.length > 0 && (
                <div className="landing-recent">
                  <span className="landing-recent-label">Recent</span>
                  <div className="landing-recent-list">
                    {allNotes.slice(0, 8).map((note) => (
                      <div
                        key={note.id}
                        className="landing-recent-item"
                        onClick={() => onOpenNote(note.id)}
                      >
                        <FileText size={14} />
                        <span>{note.title || 'Untitled Note'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="landing-formats">
                <div className="format-item">
                  <div className="format-icon format-md">
                    <FileText size={28} />
                  </div>
                  <span>.MD</span>
                </div>
                <div className="format-item">
                  <div className="format-icon format-txt">
                    <FileType size={28} />
                  </div>
                  <span>.TXT</span>
                </div>
                <div className="format-item">
                  <div className="format-icon format-html">
                    <FileCode size={28} />
                  </div>
                  <span>.HTML</span>
                </div>
                <div className="format-item">
                  <div className="format-icon format-pdf">
                    <FileDown size={28} />
                  </div>
                  <span>.PDF</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
