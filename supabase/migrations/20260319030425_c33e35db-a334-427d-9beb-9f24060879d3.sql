
-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Lost & Found table
CREATE TABLE public.lost_found (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'lost',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  image_url TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lost_found ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lost_found"
  ON public.lost_found FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own lost_found"
  ON public.lost_found FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lost_found"
  ON public.lost_found FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lost_found"
  ON public.lost_found FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
