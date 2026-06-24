import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Note, MenuActions } from './types';
import { loadNotes, saveNotes, saveVersionSnapshot, deleteVersionsForNote } from './lib/storage';
import { exportAsMd, exportAsTxt, exportAsHtml, exportAsPdf } from './lib/exporters';
import { syncNoteToCloud, fetchCloudNotes, deleteCloudNote, syncAllNotesToCloud, subscribeToNotes, fetchSharedWithMe, subscribeToSharedNotes } from './lib/cloudSync';
import { useAuth } from './contexts/AuthContext';
import { TopMenu } from './components/TopMenu';
import { TabBar } from './components/TabBar';
import { Editor } from './components/Editor';
import { LandingPage } from './components/LandingPage';
import { HelpModal } from './components/HelpModal';
import { VersionHistory } from './components/VersionHistory';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { ShareModal } from './components/ShareModal';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const VERSION_INTERVAL_MS = 60_000;
const CLOUD_SYNC_DEBOUNCE_MS = 1500;

const App: React.FC = () => {
  const { user } = useAuth();

  const [notes, setNotes] = useState<Note[]>([]);
  const [sharedNotes, setSharedNotes] = useState<Note[]>([]);
  const [openNoteIds, setOpenNoteIds] = useState<string[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [helpModal, setHelpModal] = useState<'markdown-guide' | 'about' | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lastSnapshotRef = useRef<Record<string, string>>({});
  const cloudSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tracks which note ids were changed locally so we only sync those
  const dirtyNoteIdsRef = useRef<Set<string>>(new Set());

  // ─── Initialization ───
  useEffect(() => {
    const init = async () => {
      const storedNotes = await loadNotes();
      setNotes(storedNotes);

      const snapshotMap: Record<string, string> = {};
      storedNotes.forEach((n) => { snapshotMap[n.id] = n.content; });
      lastSnapshotRef.current = snapshotMap;

      const theme = localStorage.getItem('gravel_theme');
      if (theme && theme !== 'dark') {
        document.documentElement.setAttribute('data-theme', theme);
      }
      const customBg = localStorage.getItem('gravel_custom_bg');
      if (customBg) {
        document.documentElement.style.setProperty('--custom-bg', customBg);
      }
      const customTextColor = localStorage.getItem('gravel_custom_text_color');
      if (customTextColor) {
        document.documentElement.style.setProperty('--text-primary', customTextColor);
      }

      setIsLoaded(true);
    };
    init();
  }, []);

  // ─── Auto-save to IndexedDB (instant, every keystroke) ───
  useEffect(() => {
    if (isLoaded) {
      saveNotes(notes);
    }
  }, [notes, isLoaded]);

  // ─── Cloud sync on login: merge local + cloud notes ───
  useEffect(() => {
    if (!user || !isLoaded) return;

    const mergeCloudNotes = async () => {
      // push all local notes to cloud first
      await syncAllNotesToCloud(notes, user.id);

      // then pull everything from cloud (includes notes from other devices)
      const cloudNotes = await fetchCloudNotes(user.id);

      setNotes(prev => {
        const localMap = new Map(prev.map(n => [n.id, n]));
        const merged = [...prev];

        for (const cn of cloudNotes) {
          const local = localMap.get(cn.id);
          if (!local) {
            // new note from another device
            merged.push(cn);
          } else if (cn.updatedAt > local.updatedAt) {
            // cloud version is newer, use it
            const idx = merged.findIndex(n => n.id === cn.id);
            if (idx !== -1) merged[idx] = cn;
          }
        }

        return merged;
      });

      // also fetch notes shared with me
      if (user.email) {
        const shared = await fetchSharedWithMe(user.email);
        setSharedNotes(shared);
      }
    };

    mergeCloudNotes();
  }, [user, isLoaded]);

  // ─── Realtime subscription for own notes ───
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotes(
      user.id,
      // on insert from another device
      (note) => {
        setNotes(prev => {
          if (prev.find(n => n.id === note.id)) return prev;
          return [...prev, note];
        });
      },
      // on update from another device/collaborator
      (note) => {
        // don't overwrite if we're the one who made the change
        if (dirtyNoteIdsRef.current.has(note.id)) return;
        setNotes(prev => prev.map(n => n.id === note.id ? note : n));
      },
      // on delete
      (noteId) => {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        setOpenNoteIds(prev => prev.filter(id => id !== noteId));
      },
    );

    return unsubscribe;
  }, [user]);

  // ─── Realtime subscription for shared notes ───
  useEffect(() => {
    if (!user?.email || sharedNotes.length === 0) return;

    const sharedIds = sharedNotes.map(n => n.id);
    const unsubscribe = subscribeToSharedNotes(
      user.email,
      sharedIds,
      (updatedNote) => {
        setSharedNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
      },
    );

    return unsubscribe;
  }, [user, sharedNotes]);

  // ─── Debounced cloud sync (1.5s after last keystroke) ───
  const scheduleCloudSync = useCallback((noteId: string) => {
    if (!user) return;
    dirtyNoteIdsRef.current.add(noteId);

    if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);

    cloudSyncTimerRef.current = setTimeout(() => {
      setNotes(currentNotes => {
        dirtyNoteIdsRef.current.forEach(id => {
          const note = currentNotes.find(n => n.id === id);
          if (note) syncNoteToCloud(note, user.id);
        });
        dirtyNoteIdsRef.current.clear();
        return currentNotes;
      });
    }, CLOUD_SYNC_DEBOUNCE_MS);
  }, [user]);

  // ─── Version snapshot timer ───
  useEffect(() => {
    if (!isLoaded) return;

    const interval = setInterval(() => {
      notes.forEach((note) => {
        const lastContent = lastSnapshotRef.current[note.id];
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
      }
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

  // combine own notes + shared notes for the sidebar
  const allNotes = [...notes, ...sharedNotes.filter(sn => !notes.find(n => n.id === sn.id))];

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
    lastSnapshotRef.current[newNote.id] = '';

    // sync new note to cloud immediately
    if (user) syncNoteToCloud(newNote, user.id);
  };

  const deleteNote = (id: string) => {
    if (!window.confirm('Delete this note permanently? This cannot be undone.')) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    closeTab(id);
    deleteVersionsForNote(id);
    delete lastSnapshotRef.current[id];

    if (user) deleteCloudNote(id);
  };

  const updateNoteContent = useCallback(
    (content: string) => {
      if (!activeNoteId) return;

      const firstLine = content.split('\n')[0];
      const hasHeading = firstLine && firstLine.startsWith('# ');

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id !== activeNoteId) return note;
          // only auto-derive title if the content starts with a markdown heading
          const title = hasHeading
            ? (firstLine.replace('# ', '').trim() || note.title)
            : note.title;
          return { ...note, content, title, updatedAt: Date.now() };
        })
      );

      setSharedNotes((prev) =>
        prev.map((note) => {
          if (note.id !== activeNoteId) return note;
          const title = hasHeading
            ? (firstLine.replace('# ', '').trim() || note.title)
            : note.title;
          return { ...note, content, title, updatedAt: Date.now() };
        })
      );

      scheduleCloudSync(activeNoteId);
    },
    [activeNoteId, scheduleCloudSync]
  );

  // ─── Version restore ───
  const restoreVersion = (content: string, title: string) => {
    if (!activeNoteId) return;
    setNotes((prev) =>
      prev.map((note) =>
        note.id === activeNoteId ? { ...note, content, title, updatedAt: Date.now() } : note
      )
    );
    lastSnapshotRef.current[activeNoteId] = content;
    scheduleCloudSync(activeNoteId);
  };

  // ─── Rename ───
  const startRename = () => {
    if (!activeNoteId) return;
    const note = allNotes.find((n) => n.id === activeNoteId);
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
    scheduleCloudSync(renamingNoteId);
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

      if (user) syncNoteToCloud(newNote, user.id);
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
  const activeNote = allNotes.find((n) => n.id === activeNoteId) || null;

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
    onShowSettings: () => setShowSettings(true),
    onShowAuth: () => setShowAuthModal(true),
    onShareNote: () => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      setShowShareModal(true);
    },
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
          allNotes={allNotes.map((n) => ({ id: n.id, title: n.title }))}
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
                {/* My notes */}
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

                {/* Shared with me */}
                {sharedNotes.length > 0 && (
                  <>
                    <div className="sidebar-header" style={{ marginTop: '8px', fontSize: '10px' }}>
                      <span>SHARED WITH ME</span>
                    </div>
                    {sharedNotes.filter(sn => !notes.find(n => n.id === sn.id)).map((note) => (
                      <div
                        key={note.id}
                        className={`note-list-item ${note.id === activeNoteId ? 'active' : ''}`}
                        onClick={() => openNote(note.id)}
                        style={{ opacity: 0.85 }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {note.title || 'Untitled Note'}
                        </span>
                      </div>
                    ))}
                  </>
                )}
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
              notes={openNoteIds.map((id) => allNotes.find((n) => n.id === id)!).filter(Boolean)}
              activeNoteId={activeNoteId}
              onSelectTab={setActiveNoteId}
              onCloseTab={closeTab}
            />

            <div className="editors-wrapper" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {openNoteIds.map((id) => {
                const n = allNotes.find((x) => x.id === id);
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

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      {/* Share Modal */}
      {showShareModal && activeNote && (
        <ShareModal
          noteId={activeNote.id}
          noteTitle={activeNote.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

export default App;
