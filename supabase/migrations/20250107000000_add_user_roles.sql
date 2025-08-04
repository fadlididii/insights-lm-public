-- Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Update existing users to have 'user' role by default
UPDATE public.profiles SET role = 'user' WHERE role IS NULL;

-- Make role column NOT NULL
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Update the handle_new_user function to set default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
        'user'  -- Default role for new users
    );
    RETURN new;
END;
$$;

-- Update RLS policies for notebooks to support admin access
-- Admin can view all notebooks, users can only view their own
DROP POLICY IF EXISTS "Users can view their own notebooks" ON public.notebooks;
CREATE POLICY "Users can view notebooks based on role"
    ON public.notebooks FOR SELECT
    USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admin can create notebooks for any user, users can only create for themselves
DROP POLICY IF EXISTS "Users can create their own notebooks" ON public.notebooks;
CREATE POLICY "Users can create notebooks based on role"
    ON public.notebooks FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admin can update any notebook, users can only update their own
DROP POLICY IF EXISTS "Users can update their own notebooks" ON public.notebooks;
CREATE POLICY "Users can update notebooks based on role"
    ON public.notebooks FOR UPDATE
    USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admin can delete notebooks
DROP POLICY IF EXISTS "Users can delete their own notebooks" ON public.notebooks;
CREATE POLICY "Only admin can delete notebooks"
    ON public.notebooks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Update chat histories policy to be user-specific
DROP POLICY IF EXISTS "Users can view chat histories from their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can view their own chat histories"
    ON public.n8n_chat_histories FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE id = session_id::uuid 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() AND role = 'admin'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can create chat histories in their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can create chat histories in accessible notebooks"
    ON public.n8n_chat_histories FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE id = session_id::uuid 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() AND role = 'admin'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete chat histories from their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can delete chat histories from accessible notebooks"
    ON public.n8n_chat_histories FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE id = session_id::uuid 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() AND role = 'admin'
                )
            )
        )
    );