import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Note {
  id: string;
  user_id: string; // Add this line
  notebook_id: string | null; // Make optional since notes are now user-specific
  title: string;
  content: string;
  source_type: 'user' | 'ai_response' | null;
  extracted_text: string | null;
  created_at: string;
  updated_at: string;
}

export const useNotes = (notebookId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', user?.id], // Change from notebookId to user.id
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id) // Filter by user_id instead of notebook_id
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as Note[];
    },
    enabled: !!user?.id,
  });

  const createNoteMutation = useMutation({
    mutationFn: async ({ 
      title, 
      content, 
      source_type = 'user',
      extracted_text,
      notebook_id // Keep notebook_id for reference but add user_id
    }: { 
      title: string; 
      content: string; 
      source_type?: 'user' | 'ai_response';
      extracted_text?: string;
      notebook_id?: string;
    }) => {
      if (!user?.id) throw new Error('User must be logged in');
      
      const { data, error } = await supabase
        .from('notes')
        .insert([{
          user_id: user.id, // Add user_id
          notebook_id: notebook_id || null, // Make notebook_id optional
          title,
          content,
          source_type,
          extracted_text,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: string }) => {
      const { data, error } = await supabase
        .from('notes')
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
    },
  });

  return {
    notes,
    isLoading,
    createNote: createNoteMutation.mutate,
    isCreating: createNoteMutation.isPending,
    updateNote: updateNoteMutation.mutate,
    isUpdating: updateNoteMutation.isPending,
    deleteNote: deleteNoteMutation.mutate,
    isDeleting: deleteNoteMutation.isPending,
  };
};
