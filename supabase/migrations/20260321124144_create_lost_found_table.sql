/*
  # Create lost_found table for Lost & Found posts

  1. New Tables
    - `lost_found`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `type` (text: 'lost' | 'found')
      - `title` (text)
      - `description` (text)
      - `image_url` (text, optional)
      - `contact_info` (text)
      - `location` (text, optional)
      - `is_resolved` (boolean, default false)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `lost_found` table
    - Users can view all lost/found posts (public read)
    - Users can create their own posts
    - Users can update/delete their own posts
*/

CREATE TABLE IF NOT EXISTS public.lost_found (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('lost', 'found')),
  title text NOT NULL,
  description text NOT NULL,
  image_url text,
  contact_info text NOT NULL,
  location text,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lost_found ENABLE ROW LEVEL SECURITY;

-- Anyone can view all lost/found posts
CREATE POLICY "Anyone can view lost_found posts"
  ON public.lost_found FOR SELECT
  TO authenticated, anon
  USING (true);

-- Authenticated users can create posts
CREATE POLICY "Users can create lost_found posts"
  ON public.lost_found FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update own lost_found posts"
  ON public.lost_found FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own lost_found posts"
  ON public.lost_found FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
