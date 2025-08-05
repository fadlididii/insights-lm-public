-- Allow admin users to update any profile
CREATE POLICY "Admin can update any profile" ON public.profiles
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );