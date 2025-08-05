-- ============================================================================
-- COMPLETE CONSOLIDATED DATABASE MIGRATION SCRIPT
-- This script creates the entire database schema for the InsightsLM application
-- Combines all migrations in the correct order for fresh database setup
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

-- Create enum types
DO $$ BEGIN
    CREATE TYPE source_type AS ENUM ('pdf', 'text', 'website', 'youtube', 'audio');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CORE TABLES CREATION
-- ============================================================================

-- Create profiles table with all features (roles, security questions)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    role text DEFAULT 'user' CHECK (role IN ('admin', 'user')) NOT NULL,
    security_question text,
    security_answer_hash text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create notebooks table
CREATE TABLE IF NOT EXISTS public.notebooks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    color text DEFAULT 'gray',
    icon text DEFAULT '📝',
    generation_status text DEFAULT 'completed',
    audio_overview_generation_status text,
    audio_overview_url text,
    audio_url_expires_at timestamp with time zone,
    example_questions text[] DEFAULT '{}',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create sources table
CREATE TABLE IF NOT EXISTS public.sources (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
    title text NOT NULL,
    type source_type NOT NULL,
    url text,
    file_path text,
    file_size bigint,
    display_name text,
    content text,
    summary text,
    processing_status text DEFAULT 'pending',
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL,
    source_type text DEFAULT 'user',
    extracted_text text,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create chat histories table
CREATE TABLE IF NOT EXISTS public.n8n_chat_histories (
    id serial not null,
    session_id uuid not null,
    message jsonb not null,
    constraint n8n_chat_histories_pkey primary key (id)
);

-- Create documents table for vector embeddings
CREATE TABLE IF NOT EXISTS public.documents (
    id bigserial PRIMARY KEY,
    content text,
    metadata jsonb,
    embedding vector(1536)
);

-- Create security question attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.security_question_attempts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ip_address inet,
    attempted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    success boolean DEFAULT false
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Notebooks indexes
CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON public.notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_updated_at ON public.notebooks(updated_at DESC);

-- Sources indexes
CREATE INDEX IF NOT EXISTS idx_sources_notebook_id ON public.sources(notebook_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON public.sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_processing_status ON public.sources(processing_status);

-- Notes indexes
CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON public.notes(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);

-- Chat histories indexes
CREATE INDEX IF NOT EXISTS idx_chat_histories_session_id ON public.n8n_chat_histories(session_id);

-- Security attempts indexes
CREATE INDEX IF NOT EXISTS idx_security_attempts_user_time 
ON public.security_question_attempts(user_id, attempted_at);

CREATE INDEX IF NOT EXISTS idx_security_attempts_ip_time 
ON public.security_question_attempts(ip_address, attempted_at);

-- Vector similarity index for documents
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON public.documents USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function to handle new user creation with role support
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    new.updated_at = timezone('utc'::text, now());
    RETURN new;
END;
$$;

-- Function to check notebook ownership
CREATE OR REPLACE FUNCTION public.is_notebook_owner(notebook_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.notebooks 
        WHERE id = notebook_id_param 
        AND user_id = auth.uid()
    );
$$;

-- Function to check notebook ownership for documents
CREATE OR REPLACE FUNCTION public.is_notebook_owner_for_document(doc_metadata jsonb)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.notebooks 
        WHERE id = (doc_metadata->>'notebook_id')::uuid 
        AND user_id = auth.uid()
    );
$$;

-- Function to match documents using vector similarity
CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding vector,
    match_count integer DEFAULT NULL,
    filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    id bigint,
    content text,
    metadata jsonb,
    similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        documents.id,
        documents.content,
        documents.metadata,
        1 - (documents.embedding <=> query_embedding) as similarity
    FROM public.documents
    WHERE documents.metadata @> filter
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_chat_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_question_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - PROFILES
-- ============================================================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Add admin policies for profile management
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile" ON public.profiles
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can delete any profile" ON public.profiles;
CREATE POLICY "Admin can delete any profile" ON public.profiles
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
        AND auth.uid() != profiles.id  -- Prevent admin from deleting their own account
    );

DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
CREATE POLICY "Service role can manage all profiles"
    ON public.profiles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES - NOTEBOOKS (GLOBAL ACCESS)
-- ============================================================================

-- All users can view all notebooks
DROP POLICY IF EXISTS "All users can view all notebooks" ON public.notebooks;
CREATE POLICY "All users can view all notebooks"
    ON public.notebooks FOR SELECT
    USING (true);

-- Only admin can create notebooks
DROP POLICY IF EXISTS "Only admin can create notebooks" ON public.notebooks;
CREATE POLICY "Only admin can create notebooks"
    ON public.notebooks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admin can update notebooks
DROP POLICY IF EXISTS "Only admin can update notebooks" ON public.notebooks;
CREATE POLICY "Only admin can update notebooks"
    ON public.notebooks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admin can delete notebooks
DROP POLICY IF EXISTS "Only admin can delete notebooks" ON public.notebooks;
CREATE POLICY "Only admin can delete notebooks"
    ON public.notebooks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- RLS POLICIES - SOURCES (ADMIN-ONLY CREATION)
-- ============================================================================

-- Users can view sources from all notebooks, admin can view all
DROP POLICY IF EXISTS "Users can view sources from all notebooks" ON public.sources;
CREATE POLICY "Users can view sources from all notebooks"
    ON public.sources FOR SELECT
    USING (true); -- All users can view sources since notebooks are global

-- Only admin can create sources
DROP POLICY IF EXISTS "Only admin can create sources" ON public.sources;
CREATE POLICY "Only admin can create sources"
    ON public.sources FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admin can update sources
DROP POLICY IF EXISTS "Only admin can update sources" ON public.sources;
CREATE POLICY "Only admin can update sources"
    ON public.sources FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admin can delete sources
DROP POLICY IF EXISTS "Only admin can delete sources" ON public.sources;
CREATE POLICY "Only admin can delete sources"
    ON public.sources FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- RLS POLICIES - NOTES (USER-SPECIFIC)
-- ============================================================================

-- Users can only view their own notes
DROP POLICY IF EXISTS "Users can view their own notes only" ON public.notes;
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
DROP POLICY IF EXISTS "Users can create their own notes only" ON public.notes;
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
DROP POLICY IF EXISTS "Users can update their own notes only" ON public.notes;
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
DROP POLICY IF EXISTS "Users can delete their own notes only" ON public.notes;
CREATE POLICY "Users can delete their own notes only"
    ON public.notes FOR DELETE
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- RLS POLICIES - CHAT HISTORIES (USER-SPECIFIC)
-- ============================================================================

-- Users can view their own chat histories only
DROP POLICY IF EXISTS "Users can view their own chat histories only" ON public.n8n_chat_histories;
CREATE POLICY "Users can view their own chat histories only"
    ON public.n8n_chat_histories FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE id = session_id::uuid
        )
    );

-- Users can insert chat histories
DROP POLICY IF EXISTS "Users can insert chat histories" ON public.n8n_chat_histories;
CREATE POLICY "Users can insert chat histories"
    ON public.n8n_chat_histories FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE id = session_id::uuid
        )
    );

-- Service role can manage all chat histories
DROP POLICY IF EXISTS "Service role can manage chat histories" ON public.n8n_chat_histories;
CREATE POLICY "Service role can manage chat histories"
    ON public.n8n_chat_histories FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES - DOCUMENTS
-- ============================================================================

-- Users can view documents from all notebooks
DROP POLICY IF EXISTS "Users can view documents from all notebooks" ON public.documents;
CREATE POLICY "Users can view documents from all notebooks"
    ON public.documents FOR SELECT
    USING (true); -- All users can view documents since notebooks are global

-- Only admin can insert documents
DROP POLICY IF EXISTS "Only admin can insert documents" ON public.documents;
CREATE POLICY "Only admin can insert documents"
    ON public.documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Service role can manage all documents
DROP POLICY IF EXISTS "Service role can manage all documents" ON public.documents;
CREATE POLICY "Service role can manage all documents"
    ON public.documents FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES - SECURITY QUESTION ATTEMPTS
-- ============================================================================

-- Users can view their own security attempts
DROP POLICY IF EXISTS "Users can view their own security attempts" ON public.security_question_attempts;
CREATE POLICY "Users can view their own security attempts"
    ON public.security_question_attempts FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own security attempts
DROP POLICY IF EXISTS "Users can insert their own security attempts" ON public.security_question_attempts;
CREATE POLICY "Users can insert their own security attempts"
    ON public.security_question_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role can manage security attempts for rate limiting
DROP POLICY IF EXISTS "Service role can manage security attempts" ON public.security_question_attempts;
CREATE POLICY "Service role can manage security attempts"
    ON public.security_question_attempts FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Drop existing triggers first
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_notebooks_updated_at ON public.notebooks;
DROP TRIGGER IF EXISTS update_sources_updated_at ON public.sources;
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create updated_at triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notebooks_updated_at
    BEFORE UPDATE ON public.notebooks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sources_updated_at
    BEFORE UPDATE ON public.sources
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auth user trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STORAGE BUCKETS AND POLICIES
-- ============================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  -- Sources bucket for user uploads (private)
  ('sources', 'sources', false, 52428800, ARRAY[
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/m4a'
  ]),
  
  -- Audio bucket for generated content (private)
  ('audio', 'audio', false, 104857600, ARRAY[
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/m4a'
  ]),
  
  -- Public images bucket for assets (public)
  ('public-images', 'public-images', true, 10485760, ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = EXCLUDED.public;

-- =============================================
-- RLS POLICIES FOR SOURCES BUCKET (ADMIN-ONLY)
-- =============================================

-- Only admin can view source files
DROP POLICY IF EXISTS "Only admin can view source files" ON storage.objects;
CREATE POLICY "Only admin can view source files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'sources' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admin can upload source files
DROP POLICY IF EXISTS "Only admin can upload source files" ON storage.objects;
CREATE POLICY "Only admin can upload source files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'sources' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admin can update source files
DROP POLICY IF EXISTS "Only admin can update source files" ON storage.objects;
CREATE POLICY "Only admin can update source files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'sources' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admin can delete source files
DROP POLICY IF EXISTS "Only admin can delete source files" ON storage.objects;
CREATE POLICY "Only admin can delete source files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'sources' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- =============================================
-- RLS POLICIES FOR AUDIO BUCKET
-- =============================================

-- Users can view their own audio files
DROP POLICY IF EXISTS "Users can view their own audio files" ON storage.objects;
CREATE POLICY "Users can view their own audio files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM notebooks WHERE user_id = auth.uid()
  )
);

-- Service role can manage audio files
DROP POLICY IF EXISTS "Service role can manage audio files" ON storage.objects;
CREATE POLICY "Service role can manage audio files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'audio' AND
  auth.role() = 'service_role'
);

-- Users can delete their own audio files
DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;
CREATE POLICY "Users can delete their own audio files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM notebooks WHERE user_id = auth.uid()
  )
);

-- =============================================
-- RLS POLICIES FOR PUBLIC-IMAGES BUCKET
-- =============================================

-- Anyone can view public images
DROP POLICY IF EXISTS "Anyone can view public images" ON storage.objects;
CREATE POLICY "Anyone can view public images"
ON storage.objects FOR SELECT
USING (bucket_id = 'public-images');

-- Service role can manage public images
DROP POLICY IF EXISTS "Service role can manage public images" ON storage.objects;
CREATE POLICY "Service role can manage public images"
ON storage.objects FOR ALL
USING (
  bucket_id = 'public-images' AND
  auth.role() = 'service_role'
);

-- ============================================================================
-- REALTIME CONFIGURATION
-- ============================================================================

-- Enable realtime for tables that need live updates
ALTER TABLE public.notebooks REPLICA IDENTITY FULL;
ALTER TABLE public.sources REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.n8n_chat_histories REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notebooks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.n8n_chat_histories;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- This consolidated migration includes:
-- 1. All core tables (profiles, notebooks, sources, notes, chat_histories, documents, security_question_attempts)
-- 2. User roles (admin/user) with appropriate permissions
-- 3. Security questions and answers with rate limiting
-- 4. Global notebook access (all users can view, only admins can modify)
-- 5. Admin-only source creation/modification (aligned with frontend restrictions)
-- 6. User-specific chat histories
-- 7. Enhanced RLS policies for all tables
-- 8. Storage buckets and policies (admin-only for sources)
-- 9. Realtime configuration
-- 10. All necessary indexes, functions, and triggers