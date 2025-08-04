
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import bcrypt from 'bcryptjs';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  avatar_url: string | null;
  security_question: string | null;
  security_answer_hash: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  checkSecurityAnswer: (userId: string, answer: string) => Promise<boolean>;
  updatePassword: (userId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  getUserSecurityQuestion: (email: string) => Promise<{ question: string | null; userId: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateAuthState = async (newSession: Session | null) => {
    console.log('AuthContext: Updating auth state:', newSession?.user?.email || 'No session');
    setSession(newSession);
    setUser(newSession?.user ?? null);
    
    // Fetch user profile with role information
    if (newSession?.user) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', newSession.user.id)
          .single();
        
        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          setUserProfile(null);
        } else {
          setUserProfile(profile);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setUserProfile(null);
      }
    } else {
      setUserProfile(null);
    }
    
    // Clear any previous errors on successful auth
    if (newSession && error) {
      setError(null);
    }
  };

  const clearAuthState = () => {
    console.log('AuthContext: Clearing auth state');
    setSession(null);
    setUser(null);
    setUserProfile(null);
    setError(null);
  };

  const signOut = async () => {
    try {
      console.log('AuthContext: Starting logout process...');
      
      // Clear local state immediately to provide instant feedback
      clearAuthState();
      
      // Attempt to sign out from server
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.log('AuthContext: Logout error:', error);
        
        // If session is invalid on server, we've already cleared local state
        if (error.message.includes('session_not_found') || 
            error.message.includes('Session not found') ||
            error.status === 403) {
          console.log('AuthContext: Session already invalid on server');
          return;
        }
        
        // For other errors, still ensure local session is cleared
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }
      
      console.log('AuthContext: Logout successful');
    } catch (err) {
      console.error('AuthContext: Unexpected logout error:', err);
      
      // Even if there's an error, try to clear local session
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (localError) {
        console.error('AuthContext: Failed to clear local session:', localError);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        
        console.log('AuthContext: Auth state changed:', event, newSession?.user?.email || 'No session');
        
        // Handle sign out events
        if (event === 'SIGNED_OUT') {
          clearAuthState();
          setLoading(false);
          return;
        }
        
        // Handle sign in events
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          updateAuthState(newSession);
          setLoading(false);
          return;
        }
        
        // For other events, update state if there's an actual change
        if (session?.access_token !== newSession?.access_token) {
          updateAuthState(newSession);
          if (loading) setLoading(false);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        console.log('AuthContext: Initializing auth...');
        
        // Get initial session
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('AuthContext: Error getting initial session:', sessionError);
          
          // If the session is invalid, clear local state
          if (sessionError.message.includes('session_not_found') || 
              sessionError.message.includes('Session not found')) {
            console.log('AuthContext: Session not found on server, clearing local session');
            await supabase.auth.signOut({ scope: 'local' });
            if (mounted) {
              clearAuthState();
              setLoading(false);
            }
            return;
          }
          
          if (mounted) {
            setError(sessionError.message);
            setLoading(false);
          }
          return;
        }
        
        if (mounted) {
          console.log('AuthContext: Initial session:', initialSession?.user?.email || 'No session');
          updateAuthState(initialSession);
          setLoading(false);
        }
      } catch (err) {
        console.error('AuthContext: Auth initialization error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Authentication error');
          setLoading(false);
        }
      }
    };

    // Initialize auth state after setting up listener
    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array to run only once

  // Function to get user's security question by email
  const getUserSecurityQuestion = async (email: string): Promise<{ question: string | null; userId: string | null }> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, security_question')
        .eq('email', email)
        .single();
      
      if (error || !data) {
        return { question: null, userId: null };
      }
      
      return { question: data.security_question, userId: data.id };
    } catch (err) {
      console.error('Error fetching security question:', err);
      return { question: null, userId: null };
    }
  };

  // Function to check security answer
  const checkSecurityAnswer = async (userId: string, answer: string): Promise<boolean> => {
    try {
      // Log attempt
      await supabase.from('security_question_attempts').insert({
        user_id: userId,
        ip_address: null, // You can implement IP tracking if needed
        success: false
      });

      // Get user's hashed security answer
      const { data, error } = await supabase
        .from('profiles')
        .select('security_answer_hash')
        .eq('id', userId)
        .single();
      
      if (error || !data?.security_answer_hash) {
        return false;
      }
      
      // Compare with bcrypt
      const isValid = await bcrypt.compare(answer.toLowerCase().trim(), data.security_answer_hash);
      
      // Update attempt with success status
      if (isValid) {
        await supabase.from('security_question_attempts').insert({
          user_id: userId,
          ip_address: null,
          success: true
        });
      }
      
      return isValid;
    } catch (err) {
      console.error('Error checking security answer:', err);
      return false;
    }
  };

  // Function to update password
  const updatePassword = async (userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('update-password', {
        body: { userId, newPassword }
      });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return data;
    } catch (err) {
      return { success: false, error: 'Failed to update password' };
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    session,
    loading,
    error,
    isAuthenticated: !!session,
    isAdmin: userProfile?.role === 'admin',
    signOut,
    checkSecurityAnswer,
    updatePassword,
    getUserSecurityQuestion
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
