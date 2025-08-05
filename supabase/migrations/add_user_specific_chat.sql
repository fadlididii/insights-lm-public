-- Tambahkan kolom user_id ke tabel n8n_chat_histories
ALTER TABLE public.n8n_chat_histories 
ADD COLUMN user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Buat index untuk performa query
CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories_user_id ON public.n8n_chat_histories(user_id);
CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories_session_user ON public.n8n_chat_histories(session_id, user_id);

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own chat histories only" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "Users can insert chat histories" ON public.n8n_chat_histories;

-- Users can ONLY view their own chat histories per notebook
CREATE POLICY "Users can view their own chat histories per notebook"
    ON public.n8n_chat_histories FOR SELECT
    USING (user_id = auth.uid());

-- Users can ONLY insert their own chat histories
CREATE POLICY "Users can insert their own chat histories"
    ON public.n8n_chat_histories FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can ONLY delete their own chat histories
CREATE POLICY "Users can delete their own chat histories"
    ON public.n8n_chat_histories FOR DELETE
    USING (user_id = auth.uid());

-- Service role tetap bisa manage semua (untuk system operations)
CREATE POLICY "Service role can manage chat histories"
    ON public.n8n_chat_histories FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);