
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useNotebooks = () => {
  const { user, userProfile, isAuthenticated, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: notebooks,
    isLoading,
    error,
    isError,
  } = useQuery({
    queryKey: ['notebooks', user?.id, userProfile?.role],
    queryFn: async () => {
      if (!user) {
        console.log('No user found, returning empty array');
        return [];
      }

      console.log('Fetching notebooks for user:', user.id, 'role:', userProfile?.role);
      
      // Get all notebooks (global access)
      const { data: notebooksData, error: notebooksError } = await supabase
        .from('notebooks')
        .select('*')
        .order('updated_at', { ascending: false });

      if (notebooksError) {
        console.error('Error fetching notebooks:', notebooksError);
        throw notebooksError;
      }

      // Get source counts separately for each notebook
      const notebooksWithCounts = await Promise.all(
        (notebooksData || []).map(async (notebook) => {
          const { count, error: countError } = await supabase
            .from('sources')
            .select('*', { count: 'exact', head: true })
            .eq('notebook_id', notebook.id);

          if (countError) {
            console.error('Error fetching source count for notebook:', notebook.id, countError);
            return { ...notebook, sources: [{ count: 0 }] };
          }

          return { ...notebook, sources: [{ count: count || 0 }] };
        })
      );

      console.log('Fetched notebooks:', notebooksWithCounts?.length || 0);
      return notebooksWithCounts || [];
    },
    enabled: isAuthenticated && !authLoading && !!userProfile,
    retry: (failureCount, error) => {
      if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Set up real-time subscription for ALL notebooks updates
  useEffect(() => {
    if (!user?.id || !isAuthenticated) return;

    console.log('Setting up real-time subscription for all notebooks');

    const channel = supabase
      .channel('notebooks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notebooks',
          // Remove user filter to listen to all notebook changes
        },
        (payload) => {
          console.log('Real-time notebook update received:', payload);
          
          // Invalidate and refetch notebooks when any change occurs
          queryClient.invalidateQueries({ queryKey: ['notebooks', user.id, userProfile?.role] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAuthenticated, queryClient, userProfile?.role]);

  const createNotebook = useMutation({
    mutationFn: async (notebookData: { title: string; description?: string; userId?: string }) => {
      console.log('Creating notebook with data:', notebookData);
      console.log('Current user:', user?.id, 'role:', userProfile?.role);
      
      if (!user) {
        console.error('User not authenticated');
        throw new Error('User not authenticated');
      }

      // Admin can create notebooks for other users, regular users create for themselves
      const targetUserId = (userProfile?.role === 'admin' && notebookData.userId) 
        ? notebookData.userId 
        : user.id;

      const { data, error } = await supabase
        .from('notebooks')
        .insert({
          title: notebookData.title,
          description: notebookData.description,
          user_id: targetUserId,
          generation_status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating notebook:', error);
        throw error;
      }
      
      console.log('Notebook created successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('Mutation success, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['notebooks', user?.id, userProfile?.role] });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
    },
  });

  return {
    notebooks,
    isLoading: authLoading || isLoading,
    error: error?.message || null,
    isError,
    createNotebook: createNotebook.mutate,
    isCreating: createNotebook.isPending,
  };
};
