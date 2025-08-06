-- Fix admin profile access for User Management
-- This migration fixes circular dependency in RLS policy

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profile access policy" ON public.profiles;

-- Create separate policies to avoid circular dependency
-- Policy 1: Users can always view their own profile (no role check needed)
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT 
    USING (auth.uid() = id);

-- Policy 2: Admin can view all profiles using JWT claim (no database lookup)
CREATE POLICY "Admin can view all profiles" ON public.profiles
    FOR SELECT 
    USING (auth.jwt() ->> 'role' = 'admin');
-- Create a comprehensive policy that handles both user and admin access
CREATE POLICY "Profile access policy" ON public.profiles
    FOR SELECT 
    USING (
        auth.uid() = id OR  -- Users can view their own profile
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )  -- Admin can view all profiles
    );