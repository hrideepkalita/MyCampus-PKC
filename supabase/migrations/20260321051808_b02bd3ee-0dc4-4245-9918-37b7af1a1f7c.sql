
-- Add is_verified boolean to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- Create verification_requests table
CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_card_image_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own verification requests"
ON public.verification_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can insert own verification requests"
ON public.verification_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow all authenticated to view all requests (needed for admin reads)
CREATE POLICY "Authenticated can view all verification requests"
ON public.verification_requests FOR SELECT TO authenticated
USING (true);

-- Allow all authenticated to update requests (admin check in app)
CREATE POLICY "Authenticated can update verification requests"
ON public.verification_requests FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);
