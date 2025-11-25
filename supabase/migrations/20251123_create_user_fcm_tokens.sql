CREATE TABLE IF NOT EXISTS public.user_fcm_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)
);

-- RLS Policies
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only insert their own tokens"
ON public.user_fcm_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only select their own tokens"
ON public.user_fcm_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only update their own tokens"
ON public.user_fcm_tokens FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own tokens"
ON public.user_fcm_tokens FOR DELETE
USING (auth.uid() = user_id);
