// The core data model for a note in Gravel.
// Each note gets a unique ID, a user-facing title, the raw markdown content,
// and timestamps for creation and last modification.

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// A snapshot of a note's content at a specific point in time.
// The version history system takes one of these every 60 seconds (if content changed).
// We keep the last 10 per note, older ones get pruned automatically.
export interface NoteVersion {
  noteId: string;
  content: string;
  title: string;
  timestamp: number;
}

// Callback signatures that the TopMenu uses to communicate actions back to App.
// This keeps the menu component decoupled from any specific state management.
export interface MenuActions {
  onNewNote: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onRenameNote: () => void;
  onDeleteNote: () => void;
  onExportMd: () => void;
  onExportTxt: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSidebar: () => void;
  onTogglePreview: () => void;
  onShowMarkdownGuide: () => void;
  onShowAbout: () => void;
  onShowVersionHistory: () => void;
  onShowSettings: () => void;
  onShowAuth: () => void;
  onShareNote: () => void;
}
