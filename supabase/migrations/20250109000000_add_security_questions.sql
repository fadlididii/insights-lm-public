-- Add security question fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS security_question text,
ADD COLUMN IF NOT EXISTS security_answer_hash text;

-- Add table for tracking failed security question attempts (rate limiting)
CREATE TABLE IF NOT EXISTS public.security_question_attempts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ip_address inet,
    attempted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    success boolean DEFAULT false
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_attempts_user_time 
ON public.security_question_attempts(user_id, attempted_at);

CREATE INDEX IF NOT EXISTS idx_security_attempts_ip_time 
ON public.security_question_attempts(ip_address, attempted_at);

-- Enable RLS
ALTER TABLE public.security_question_attempts ENABLE ROW LEVEL SECURITY;

-- RLS policies for security_question_attempts
CREATE POLICY "Users can view their own security attempts" ON public.security_question_attempts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own security attempts" ON public.security_question_attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);