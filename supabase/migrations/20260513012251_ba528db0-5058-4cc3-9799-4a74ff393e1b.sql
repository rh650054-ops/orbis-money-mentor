
-- Posts
CREATE TABLE public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('global','regional')),
  content TEXT NOT NULL,
  image_url TEXT,
  city TEXT,
  state TEXT,
  nickname TEXT,
  avatar_url TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_channel_created ON public.community_posts(channel, created_at DESC);
CREATE INDEX idx_posts_state ON public.community_posts(state);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view posts" ON public.community_posts FOR SELECT TO authenticated USING (is_deleted = false);
CREATE POLICY "insert own post" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own post" ON public.community_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own post" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comments
CREATE TABLE public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  nickname TEXT,
  avatar_url TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_post ON public.community_comments(post_id, created_at);
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view comments" ON public.community_comments FOR SELECT TO authenticated USING (is_deleted = false);
CREATE POLICY "insert own comment" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own comment" ON public.community_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own comment" ON public.community_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Likes (post or comment)
CREATE TABLE public.community_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.community_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_target CHECK ((post_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int = 1)
);
CREATE UNIQUE INDEX uniq_like_post ON public.community_likes(user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_like_comment ON public.community_likes(user_id, comment_id) WHERE comment_id IS NOT NULL;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view likes" ON public.community_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own like" ON public.community_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own like" ON public.community_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('community-media', 'community-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "community media public read" ON storage.objects FOR SELECT USING (bucket_id = 'community-media');
CREATE POLICY "community media user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "community media user update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'community-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "community media user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Triggers
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profanity filter on posts/comments
CREATE OR REPLACE FUNCTION public.community_filter_profanity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.content := public.filter_profanity(NEW.content);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_posts_profanity BEFORE INSERT OR UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_filter_profanity();
CREATE TRIGGER trg_comments_profanity BEFORE INSERT OR UPDATE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.community_filter_profanity();
