
-- 1. Add city and state to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- 2. Profanity filter function
CREATE OR REPLACE FUNCTION public.filter_profanity(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  filtered TEXT := input_text;
  bad_words TEXT[] := ARRAY[
    'porra','caralho','merda','foda','fodase','foda-se','puta','puto','viado','viadinho',
    'cuzao','cuzão','arrombado','desgraça','desgraca','vagabundo','vagabunda','fdp',
    'filho da puta','filhodaputa','cu','buceta','piroca','pinto','rola','corno','corna',
    'otario','otário','idiota','imbecil','retardado','retardada','babaca','bosta',
    'safado','safada','escroto','escrota','vai se foder','vsf','tnc','toma no cu'
  ];
  word TEXT;
BEGIN
  IF filtered IS NULL THEN RETURN NULL; END IF;
  FOREACH word IN ARRAY bad_words LOOP
    filtered := regexp_replace(filtered, '\m' || word || '\M', repeat('*', length(word)), 'gi');
  END LOOP;
  RETURN filtered;
END;
$$;

-- 3. chat_messages table (Global / Regional)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('global','regional')),
  city TEXT,
  state TEXT,
  nickname TEXT,
  avatar_url TEXT,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_global ON public.chat_messages (channel, created_at DESC) WHERE channel = 'global';
CREATE INDEX IF NOT EXISTS idx_chat_messages_regional ON public.chat_messages (channel, state, city, created_at DESC) WHERE channel = 'regional';

-- Apply profanity filter on insert/update
CREATE OR REPLACE FUNCTION public.chat_messages_apply_filter()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.content := public.filter_profanity(NEW.content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_messages_filter ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_filter
BEFORE INSERT OR UPDATE OF content ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_messages_apply_filter();

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view chat messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (is_deleted = false);

CREATE POLICY "Users can send their own chat messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update (soft-delete) their own messages"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. ai_conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations (user_id, last_message_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own AI conversations - select"
  ON public.ai_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own AI conversations - insert"
  ON public.ai_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own AI conversations - update"
  ON public.ai_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own AI conversations - delete"
  ON public.ai_conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. ai_messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON public.ai_messages (conversation_id, created_at ASC);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own AI messages"
  ON public.ai_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own AI messages"
  ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own AI messages"
  ON public.ai_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Bump conversation last_message_at on new message
CREATE OR REPLACE FUNCTION public.bump_ai_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_conversations
  SET last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_ai_conv ON public.ai_messages;
CREATE TRIGGER trg_bump_ai_conv
AFTER INSERT ON public.ai_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_ai_conversation_timestamp();

-- 6. Realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.ai_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_messages;
