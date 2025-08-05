-- Allow admin users to delete any profile (except their own)
CREATE POLICY "Admin can delete any profile" ON public.profiles
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
        AND auth.uid() != profiles.id  -- Prevent admin from deleting their own account
    );