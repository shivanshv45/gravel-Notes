import { supabase } from './supabase';
import type { Note, NoteComment } from '../types';
import type { ShareRole } from '../types';

export type { ShareRole };

export interface NoteShare {
  id: string;
  note_id: string;
  shared_with_email: string;
  role: ShareRole;
  created_at: string;
}

// push a single note to supabase
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

// pull all notes for the current user
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

export const deleteCloudNote = async (noteId: string): Promise<void> => {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) console.error('[Gravel] Cloud delete failed:', error.message);
};

// bulk sync all local notes on login
export const syncAllNotesToCloud = async (notes: Note[], userId: string): Promise<void> => {
  if (notes.length === 0) return;
  const rows = notes.map(note => ({
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  }));
  const { error } = await supabase.from('notes').upsert(rows, { onConflict: 'id' });
  if (error) console.error('[Gravel] Bulk cloud sync failed:', error.message);
};

// realtime subscription for own notes
export const subscribeToNotes = (
  userId: string,
  onInsert: (note: Note) => void,
  onUpdate: (note: Note) => void,
  onDelete: (noteId: string) => void,
) => {
  const channel = supabase
    .channel('notes-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as any;
        onInsert({ id: row.id, title: row.title, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at });
      })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as any;
        onUpdate({ id: row.id, title: row.title, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at });
      })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
      (payload) => { onDelete((payload.old as any).id); })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

// ─── Sharing ───

export const shareNote = async (noteId: string, email: string, role: ShareRole): Promise<{ error?: string }> => {
  const { error } = await supabase
    .from('note_shares')
    .upsert({ note_id: noteId, shared_with_email: email, role }, { onConflict: 'note_id,shared_with_email' });
  if (error) return { error: error.message };
  return {};
};

export const removeShare = async (noteId: string, email: string): Promise<void> => {
  await supabase.from('note_shares').delete().eq('note_id', noteId).eq('shared_with_email', email);
};

export const getSharesForNote = async (noteId: string): Promise<NoteShare[]> => {
  const { data, error } = await supabase.from('note_shares').select('*').eq('note_id', noteId);
  if (error) return [];
  return data || [];
};

// fetch notes shared with me, along with roles
export const fetchSharedWithMe = async (email: string): Promise<{ notes: Note[]; roles: Record<string, ShareRole> }> => {
  const { data: shares } = await supabase
    .from('note_shares')
    .select('note_id, role')
    .eq('shared_with_email', email);

  if (!shares || shares.length === 0) return { notes: [], roles: {} };

  const noteIds = shares.map(s => s.note_id);
  const roles: Record<string, ShareRole> = {};
  shares.forEach(s => { roles[s.note_id] = s.role as ShareRole; });

  const { data: notes } = await supabase.from('notes').select('*').in('id', noteIds);

  const mapped = (notes || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { notes: mapped, roles };
};

// realtime for shared notes
export const subscribeToSharedNotes = (noteIds: string[], onUpdate: (note: Note) => void) => {
  if (noteIds.length === 0) return () => {};
  const channel = supabase
    .channel('shared-notes-realtime')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notes' },
      (payload) => {
        const row = payload.new as any;
        if (noteIds.includes(row.id)) {
          onUpdate({ id: row.id, title: row.title, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at });
        }
      })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

// ─── Comments ───

const MAX_COMMENTS_PER_USER_PER_NOTE = 20;

export const fetchComments = async (noteId: string): Promise<NoteComment[]> => {
  const { data, error } = await supabase
    .from('note_comments')
    .select('*')
    .eq('note_id', noteId)
    .order('line_number', { ascending: true });
  if (error) return [];
  return data || [];
};

export const addComment = async (
  noteId: string,
  userEmail: string,
  lineNumber: number,
  content: string,
  color: string,
): Promise<{ error?: string }> => {
  // rate limit: max comments per user per note
  const { count } = await supabase
    .from('note_comments')
    .select('*', { count: 'exact', head: true })
    .eq('note_id', noteId)
    .eq('user_email', userEmail);

  if (count !== null && count >= MAX_COMMENTS_PER_USER_PER_NOTE) {
    return { error: `Max ${MAX_COMMENTS_PER_USER_PER_NOTE} comments per note reached` };
  }

  const { error } = await supabase
    .from('note_comments')
    .insert({ note_id: noteId, user_email: userEmail, line_number: lineNumber, content, color });

  if (error) return { error: error.message };
  return {};
};

export const deleteComment = async (commentId: string): Promise<void> => {
  await supabase.from('note_comments').delete().eq('id', commentId);
};

export const subscribeToComments = (noteId: string, onChange: () => void) => {
  const channel = supabase
    .channel(`comments-${noteId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'note_comments', filter: `note_id=eq.${noteId}` },
      () => { onChange(); })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};
