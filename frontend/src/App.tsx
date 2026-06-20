import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Note, MenuActions } from './types';
import { loadNotes, saveNotes, saveVersionSnapshot, deleteVersionsForNote } from './lib/storage';
import { exportAsMd, exportAsTxt, exportAsHtml, exportAsPdf } from './lib/exporters';
import { TopMenu } from './components/TopMenu';
import { TabBar } from './components/TabBar';
import { Editor } from './components/Editor';
import { LandingPage } from './components/LandingPage';
import { HelpModal } from './components/HelpModal';
import { VersionHistory } from './components/VersionHistory';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

// ─── Version snapshot interval (ms) ───
// Every 60 seconds we take a snapshot of any note whose content has changed.
const VERSION_INTERVAL_MS = 60_000;

const App: React.FC = () => {
  // All notes stored in IndexedDB
  const [notes, setNotes] = useState<Note[]>([]);

  // Which notes are currently open as tabs
  const [openNoteIds, setOpenNoteIds] = useState<string[]>([]);

  // The currently focused tab
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [helpModal, setHelpModal] = useState<'markdown-guide' | 'about' | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track what the content looked like at the last version snapshot,
  // so we only save a new snapshot if the user actually changed something.
  const lastSnapshotRef = useRef<Record<string, string>>({});

  // ─── Initialization ───
  useEffect(() => {
    const init = async () => {
      const storedNotes = await loadNotes();
      setNotes(storedNotes);

      // Seed the snapshot tracker with the current content of each note
      const snapshotMap: Record<string, string> = {};
      storedNotes.forEach((n) => { snapshotMap[n.id] = n.content; });
      lastSnapshotRef.current = snapshotMap;

      setIsLoaded(true);
    };
    init();
  }, []);

  // ─── Auto-save to IndexedDB ───
  // This fires on every keystroke (debounced by React batching).
  // IndexedDB via localforage is fast enough for this.
  useEffect(() => {
    if (isLoaded) {
      saveNotes(notes);
    }
  }, [notes, isLoaded]);

  // ─── Version snapshot timer ───
  // Every 60 seconds, check every open note. If its content differs from
  // the last snapshot, save a new version to IndexedDB.
  useEffect(() => {
    if (!isLoaded) return;

    const interval = setInterval(() => {
      notes.forEach((note) => {
        const lastContent = lastSnapshotRef.current[note.id];
        // Only snapshot if the content actually changed since the last snapshot
        if (lastContent !== undefined && lastContent !== note.content) {
          saveVersionSnapshot(note);
          lastSnapshotRef.current[note.id] = note.content;
        }
      });
    }, VERSION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isLoaded, notes]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        createNewNote();
      }
      if (ctrl && e.key === 's') {
        e.preventDefault();
        // Auto-saved already, prevent the browser's save dialog
      }
      // Ctrl+Z and Ctrl+Y are handled natively by the textarea for undo/redo
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── Drag & Drop ───
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.files) {
        Array.from(e.dataTransfer.files).forEach(importFile);
      }
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // ─── Tab & Note Management ───

  const openNote = (id: string) => {
    if (!openNoteIds.includes(id)) {
      setOpenNoteIds((prev) => [...prev, id]);
    }
    setActiveNoteId(id);
  };

  const closeTab = (id: string) => {
    const newOpenIds = openNoteIds.filter((noteId) => noteId !== id);
    setOpenNoteIds(newOpenIds);
    if (activeNoteId === id) {
      setActiveNoteId(newOpenIds.length > 0 ? newOpenIds[newOpenIds.length - 1] : null);
    }
  };

  const createNewNote = () => {
    const newNote: Note = {
      id: uuidv4(),
      title: 'Untitled Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNotes((prev) => [...prev, newNote]);
    setOpenNoteIds((prev) => [...prev, newNote.id]);
    setActiveNoteId(newNote.id);

    // Seed the snapshot tracker for this new note
    lastSnapshotRef.current[newNote.id] = '';
  };

  const deleteNote = (id: string) => {
    if (!window.confirm('Delete this note permanently? This cannot be undone.')) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    closeTab(id);

    // Clean up version history for the deleted note
    deleteVersionsForNote(id);
    delete lastSnapshotRef.current[id];
  };

  const updateNoteContent = useCallback(
    (content: string) => {
      if (!activeNoteId) return;

      let title = 'Untitled Note';
      const firstLine = content.split('\n')[0];
      if (firstLine && firstLine.startsWith('# ')) {
        title = firstLine.replace('# ', '').trim() || 'Untitled Note';
      }

      setNotes((prev) =>
        prev.map((note) =>
          note.id === activeNoteId ? { ...note, content, title, updatedAt: Date.now() } : note
        )
      );
    },
    [activeNoteId]
  );

  // ─── Version restore ───
  // Called when the user picks a snapshot from the Version History modal
  const restoreVersion = (content: string, title: string) => {
    if (!activeNoteId) return;
    setNotes((prev) =>
      prev.map((note) =>
        note.id === activeNoteId ? { ...note, content, title, updatedAt: Date.now() } : note
      )
    );
    // Update the snapshot tracker so we don't re-snapshot the restored content immediately
    lastSnapshotRef.current[activeNoteId] = content;
  };

  // ─── Rename ───
  const startRename = () => {
    if (!activeNoteId) return;
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note) return;
    setRenamingNoteId(activeNoteId);
    setRenameValue(note.title);
  };

  const commitRename = () => {
    if (!renamingNoteId || !renameValue.trim()) {
      setRenamingNoteId(null);
      return;
    }
    setNotes((prev) =>
      prev.map((note) =>
        note.id === renamingNoteId ? { ...note, title: renameValue.trim(), updatedAt: Date.now() } : note
      )
    );
    setRenamingNoteId(null);
  };

  // ─── File Import ───
  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const title = file.name.replace(/\.(md|txt)$/i, '') || 'Imported Note';
      const newNote: Note = {
        id: uuidv4(),
        title,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setNotes((prev) => [...prev, newNote]);
      setOpenNoteIds((prev) => [...prev, newNote.id]);
      setActiveNoteId(newNote.id);
      lastSnapshotRef.current[newNote.id] = content;
    };
    reader.readAsText(file);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(importFile);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Menu Actions ───
  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  const menuActions: MenuActions = {
    onNewNote: createNewNote,
    onOpenFile: openFilePicker,
    onSave: () => {},
    onRenameNote: startRename,
    onDeleteNote: () => activeNoteId && deleteNote(activeNoteId),
    onExportMd: () => activeNote && exportAsMd(activeNote),
    onExportTxt: () => activeNote && exportAsTxt(activeNote),
    onExportHtml: () => activeNote && exportAsHtml(activeNote),
    onExportPdf: () => activeNote && exportAsPdf(activeNote),
    onUndo: () => window.dispatchEvent(new Event('app-undo')),
    onRedo: () => window.dispatchEvent(new Event('app-redo')),
    onToggleSidebar: () => setIsSidebarOpen((prev) => !prev),
    onTogglePreview: () => setShowPreview((prev) => !prev),
    onShowMarkdownGuide: () => setHelpModal('markdown-guide'),
    onShowAbout: () => setHelpModal('about'),
    onShowVersionHistory: () => setShowVersionHistory(true),
  };

  // ─── Render ───

  if (!isLoaded) return null;

  const showLanding = openNoteIds.length === 0;

  return (
    <div className="app-container">
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,.markdown"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      <TopMenu actions={menuActions} hasActiveNote={!!activeNote} />

      {showLanding ? (
        <LandingPage
          onNewNote={createNewNote}
          onOpenFile={openFilePicker}
          onShowMarkdownGuide={() => setHelpModal('markdown-guide')}
          allNotes={notes.map((n) => ({ id: n.id, title: n.title }))}
          onOpenNote={openNote}
        />
      ) : (
        <div className="workspace">
          {/* Sidebar */}
          {isSidebarOpen && (
            <div className="sidebar">
              <div className="sidebar-header">
                <span>EXPLORER</span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button onClick={() => setIsSidebarOpen(false)} title="Close Sidebar" style={{ display: 'flex', alignItems: 'center' }}>
                    <PanelLeftClose size={14} />
                  </button>
                  <button onClick={createNewNote} style={{ fontSize: '16px', lineHeight: 1 }} title="New Note">
                    +
                  </button>
                </div>
              </div>
              <div className="note-list">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`note-list-item ${note.id === activeNoteId ? 'active' : ''}`}
                    onClick={() => openNote(note.id)}
                    onDoubleClick={() => {
                      setRenamingNoteId(note.id);
                      setRenameValue(note.title);
                    }}
                  >
                    {renamingNoteId === note.id ? (
                      <input
                        className="rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingNoteId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {note.title || 'Untitled Note'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="editor-container">
            {!isSidebarOpen && (
              <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(true)} title="Open Sidebar">
                <PanelLeftOpen size={16} />
              </button>
            )}

            <TabBar
              notes={openNoteIds.map((id) => notes.find((n) => n.id === id)!).filter(Boolean)}
              activeNoteId={activeNoteId}
              onSelectTab={setActiveNoteId}
              onCloseTab={closeTab}
            />

            <div className="editors-wrapper" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {openNoteIds.map((id) => {
                const n = notes.find((x) => x.id === id);
                if (!n) return null;
                return (
                  <div
                    key={id}
                    style={{
                      display: id === activeNoteId ? 'flex' : 'none',
                      width: '100%',
                      height: '100%',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                  >
                    <Editor note={n} onChange={updateNoteContent} showPreview={showPreview} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Help modals */}
      {helpModal && <HelpModal type={helpModal} onClose={() => setHelpModal(null)} />}

      {/* Version History modal */}
      {showVersionHistory && activeNote && (
        <VersionHistory
          noteId={activeNote.id}
          noteTitle={activeNote.title}
          onRestore={restoreVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}
    </div>
  );
};

export default App;
