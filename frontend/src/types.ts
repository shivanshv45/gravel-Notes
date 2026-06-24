export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export type NoteRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export type ShareRole = 'viewer' | 'commenter' | 'editor';

export interface NoteComment {
  id: string;
  note_id: string;
  user_email: string;
  line_number: number;
  content: string;
  color: string;
  created_at: string;
}

export interface NoteVersion {
  noteId: string;
  content: string;
  title: string;
  timestamp: number;
}

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
