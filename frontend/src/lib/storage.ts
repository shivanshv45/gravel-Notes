import localforage from 'localforage';
import type { Note, NoteVersion } from '../types';

// We use localforage instead of raw localStorage because it wraps IndexedDB,
// giving us async, non-blocking storage with much larger capacity limits.
// Notes are stored as a single array under one key for simplicity.

const STORE_KEY = 'gravel_workspace_notes';
const VERSIONS_KEY = 'gravel_version_history';

// How many version snapshots to keep per note.
// Older snapshots beyond this limit get pruned automatically.
const MAX_VERSIONS_PER_NOTE = 10;

// ─── Notes ───

export const loadNotes = async (): Promise<Note[]> => {
  try {
    const notes = await localforage.getItem<Note[]>(STORE_KEY);
    return notes || [];
  } catch (err) {
    console.error('[Gravel] Failed to load notes from IndexedDB:', err);
    return [];
  }
};

export const saveNotes = async (notes: Note[]): Promise<void> => {
  try {
    await localforage.setItem(STORE_KEY, notes);
  } catch (err) {
    console.error('[Gravel] Failed to persist notes to IndexedDB:', err);
  }
};

// ─── Version History ───
// Every 60 seconds, we snapshot the current state of the active note.
// We store all versions in a flat array, keyed by noteId.
// When reading, we filter by noteId and sort by timestamp descending (newest first).

export const loadAllVersions = async (): Promise<NoteVersion[]> => {
  try {
    const versions = await localforage.getItem<NoteVersion[]>(VERSIONS_KEY);
    return versions || [];
  } catch (err) {
    console.error('[Gravel] Failed to load version history:', err);
    return [];
  }
};

export const saveVersionSnapshot = async (note: Note): Promise<void> => {
  try {
    const allVersions = await loadAllVersions();

    // Add the new snapshot
    const newVersion: NoteVersion = {
      noteId: note.id,
      content: note.content,
      title: note.title,
      timestamp: Date.now(),
    };
    allVersions.push(newVersion);

    // Keep only the last MAX_VERSIONS_PER_NOTE snapshots for this note
    const thisNoteVersions = allVersions
      .filter((v) => v.noteId === note.id)
      .sort((a, b) => b.timestamp - a.timestamp);

    const idsToKeep = new Set(
      thisNoteVersions.slice(0, MAX_VERSIONS_PER_NOTE).map((v) => v.timestamp)
    );

    // Rebuild: keep all versions for other notes + only the recent ones for this note
    const pruned = allVersions.filter(
      (v) => v.noteId !== note.id || idsToKeep.has(v.timestamp)
    );

    await localforage.setItem(VERSIONS_KEY, pruned);
  } catch (err) {
    console.error('[Gravel] Failed to save version snapshot:', err);
  }
};

export const getVersionsForNote = async (noteId: string): Promise<NoteVersion[]> => {
  const allVersions = await loadAllVersions();
  return allVersions
    .filter((v) => v.noteId === noteId)
    .sort((a, b) => b.timestamp - a.timestamp); // Newest first
};

// When a note is deleted, clean up its version history too
export const deleteVersionsForNote = async (noteId: string): Promise<void> => {
  try {
    const allVersions = await loadAllVersions();
    const filtered = allVersions.filter((v) => v.noteId !== noteId);
    await localforage.setItem(VERSIONS_KEY, filtered);
  } catch (err) {
    console.error('[Gravel] Failed to delete versions for note:', err);
  }
};
