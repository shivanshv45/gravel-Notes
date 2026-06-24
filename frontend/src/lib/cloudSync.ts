import { supabase } from './supabase';
import type { Note } from '../types';

// push a single note to supabase, upsert by id
export const syncNoteToCloud = async (note: Note, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notes')
    .upsert({
      id: note.id,
      user_id: userId,
      title: note.title,
      content: note.content,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
    }, { onConflict: 'id' });

  if (error) console.error('[Gravel] Cloud sync failed:', error.message);
};

// pull all notes belonging to the current user
export const fetchCloudNotes = async (userId: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Gravel] Failed to fetch cloud notes:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

// delete a note from the cloud
export const deleteCloudNote = async (noteId: string): Promise<void> => {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);

  if (error) console.error('[Gravel] Cloud delete failed:', error.message);
};

// bulk sync all local notes to cloud (used on login)
export const syncAllNotesToCloud = async (notes: Note[], userId: string): Promise<void> => {
  const rows = notes.map(note => ({
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('notes')
    .upsert(rows, { onConflict: 'id' });

  if (error) console.error('[Gravel] Bulk cloud sync failed:', error.message);
};

// subscribe to realtime changes on the notes table for this user
export const subscribeToNotes = (
  userId: string,
  onInsert: (note: Note) => void,
  onUpdate: (note: Note) => void,
  onDelete: (noteId: string) => void,
) => {
  const channel = supabase
    .channel('notes-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as any;
        onInsert({
          id: row.id,
          title: row.title,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as any;
        onUpdate({
          id: row.id,
          title: row.title,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.old as any;
        onDelete(row.id);
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

// ─── Sharing ───

export type ShareRole = 'viewer' | 'commenter' | 'editor';

export interface NoteShare {
  id: string;
  note_id: string;
  shared_with_email: string;
  role: ShareRole;
  created_at: string;
}

export const shareNote = async (noteId: string, email: string, role: ShareRole): Promise<{ error?: string }> => {
  const { error } = await supabase
    .from('note_shares')
    .upsert({
      note_id: noteId,
      shared_with_email: email,
      role,
    }, { onConflict: 'note_id,shared_with_email' });

  if (error) return { error: error.message };
  return {};
};

export const removeShare = async (noteId: string, email: string): Promise<void> => {
  const { error } = await supabase
    .from('note_shares')
    .delete()
    .eq('note_id', noteId)
    .eq('shared_with_email', email);

  if (error) console.error('[Gravel] Remove share failed:', error.message);
};

export const getSharesForNote = async (noteId: string): Promise<NoteShare[]> => {
  const { data, error } = await supabase
    .from('note_shares')
    .select('*')
    .eq('note_id', noteId);

  if (error) {
    console.error('[Gravel] Failed to fetch shares:', error.message);
    return [];
  }

  return data || [];
};

// get notes shared with me (by my email)
export const fetchSharedWithMe = async (email: string): Promise<Note[]> => {
  const { data: shares, error: sharesError } = await supabase
    .from('note_shares')
    .select('note_id, role')
    .eq('shared_with_email', email);

  if (sharesError || !shares || shares.length === 0) return [];

  const noteIds = shares.map(s => s.note_id);

  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('*')
    .in('id', noteIds);

  if (notesError) {
    console.error('[Gravel] Failed to fetch shared notes:', notesError.message);
    return [];
  }

  return (notes || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

// subscribe to realtime changes on notes shared with me
export const subscribeToSharedNotes = (
  email: string,
  noteIds: string[],
  onUpdate: (note: Note) => void,
) => {
  if (noteIds.length === 0) return () => {};

  const channel = supabase
    .channel('shared-notes-realtime')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notes' },
      (payload) => {
        const row = payload.new as any;
        if (noteIds.includes(row.id)) {
          onUpdate({
            id: row.id,
            title: row.title,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          });
        }
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};
