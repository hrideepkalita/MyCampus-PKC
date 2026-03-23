
CREATE TABLE public.confession_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  confession_id UUID NOT NULL REFERENCES public.confessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reply_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.confession_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view replies"
  ON public.confession_replies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own replies"
  ON public.confession_replies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own replies"
  ON public.confession_replies FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_confession_replies_confession_id ON public.confession_replies(confession_id);
