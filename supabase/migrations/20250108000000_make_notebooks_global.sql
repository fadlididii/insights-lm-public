-- Update notebooks policy to allow global read access
DROP POLICY IF EXISTS "Users can view notebooks based on role" ON public.notebooks;
CREATE POLICY "All users can view all notebooks"
    ON public.notebooks FOR SELECT
    USING (true); -- Allow all authenticated users to view all notebooks

-- Keep admin-only creation policy but allow admins to create for any user
DROP POLICY IF EXISTS "Users can create notebooks based on role" ON public.notebooks;
CREATE POLICY "Only admin can create notebooks"
    ON public.notebooks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Keep admin-only update policy
DROP POLICY IF EXISTS "Users can update notebooks based on role" ON public.notebooks;
CREATE POLICY "Only admin can update notebooks"
    ON public.notebooks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Keep admin-only delete policy (already correct)