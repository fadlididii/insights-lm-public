-- Add INSERT policy for profiles table (only if it doesn't exist)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow service_role to manage all profiles (only if it doesn't exist)
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
CREATE POLICY "Service role can manage all profiles" ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);