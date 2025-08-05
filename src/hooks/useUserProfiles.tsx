import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  created_at: string;
}

export const useUserProfiles = () => {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAdmin = userProfile?.role === 'admin';

  // Fetch all user profiles (admin only)
  const {
    data: users,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['user-profiles'],
    queryFn: async () => {
      if (!isAdmin) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data as UserProfile[];
    },
    enabled: isAdmin,
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'user' }) => {
      if (!isAdmin) {
        throw new Error('Unauthorized: Admin access required');
      }

      console.log('Attempting to update user:', userId, 'to role:', newRole);

      // First, check if the user exists
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', userId)
        .single();

      if (checkError || !existingUser) {
        console.error('User not found:', userId, checkError);
        throw new Error(`No user found with ID: ${userId}`);
      }

      console.log('Found user:', existingUser);

      // Prevent users from changing their own role
      if (userId === userProfile?.id) {
        throw new Error('You cannot change your own role');
      }

      // Now update the role
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select('id, email, full_name, role, created_at');

      if (error) {
        console.error('Error updating role:', error);
        throw error;
      }

      console.log('Update result:', data);

      if (!data || data.length === 0) {
        throw new Error('Update failed: No rows affected');
      }

      return data[0];
    },
    onSuccess: (data) => {
      // Invalidate and refetch user profiles
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      
      toast({
        title: 'Role Updated',
        description: `User role has been updated to ${data.role}`,
      });
    },
    onError: (error: any) => {
      console.error('Error updating user role:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update user role',
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!isAdmin) {
        throw new Error('Unauthorized: Admin access required');
      }

      console.log('Attempting to delete user:', userId);

      // Prevent users from deleting their own account
      if (userId === userProfile?.id) {
        throw new Error('You cannot delete your own account');
      }

      // First, check if the user exists
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('id', userId)
        .single();

      if (checkError || !existingUser) {
        console.error('User not found:', userId, checkError);
        throw new Error(`No user found with ID: ${userId}`);
      }

      console.log('Found user to delete:', existingUser);

      // Delete the user profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user:', error);
        throw error;
      }

      return { userId, email: existingUser.email };
    },
    onSuccess: (data) => {
      // Invalidate and refetch user profiles
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      
      toast({
        title: 'User Deleted',
        description: `User ${data.email} has been successfully deleted`,
      });
    },
    onError: (error: any) => {
      console.error('Error deleting user:', error);
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    },
  });

  return {
    users,
    isLoading,
    error,
    updateUserRole: updateUserRoleMutation.mutate,
    isUpdating: updateUserRoleMutation.isPending,
    deleteUser: deleteUserMutation.mutate,
    isDeleting: deleteUserMutation.isPending,
  };
};