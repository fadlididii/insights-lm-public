-- Add user_id column to notes table to make notes user-specific
ALTER TABLE public.notes 
ADD COLUMN user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update existing notes to have user_id based on notebook owner
UPDATE public.notes 
SET user_id = (
    SELECT notebooks.user_id 
    FROM public.notebooks 
    WHERE notebooks.id = notes.notebook_id
)
WHERE user_id IS NULL;

-- Make user_id column NOT NULL after updating existing data
ALTER TABLE public.notes ALTER COLUMN user_id SET NOT NULL;

-- Create index for user_id queries
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);

-- ============================================================================
-- UPDATE RLS POLICIES - NOTES (USER-SPECIFIC)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view notes based on role" ON public.notes;
DROP POLICY IF EXISTS "Users can create notes based on role" ON public.notes;
DROP POLICY IF EXISTS "Users can update notes based on role" ON public.notes;
DROP POLICY IF EXISTS "Users can delete notes based on role" ON public.notes;

-- Users can only view their own notes
CREATE POLICY "Users can view their own notes only"
    ON public.notes FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can only create notes for themselves
CREATE POLICY "Users can create their own notes only"
    ON public.notes FOR INSERT
    WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can only update their own notes
CREATE POLICY "Users can update their own notes only"
    ON public.notes FOR UPDATE
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can only delete their own notes
CREATE POLICY "Users can delete their own notes only"
    ON public.notes FOR DELETE
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );