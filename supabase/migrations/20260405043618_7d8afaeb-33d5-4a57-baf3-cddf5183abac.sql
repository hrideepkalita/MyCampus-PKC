
-- Comments table with nested replies support
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view comments" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);

-- Add semester column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS semester TEXT DEFAULT NULL;
