import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FeedChannel = "global" | "regional";

export interface FeedPost {
  id: string;
  user_id: string;
  channel: FeedChannel;
  content: string;
  image_url: string | null;
  city: string | null;
  state: string | null;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
}

export interface FeedComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
  likes_count: number;
  liked_by_me: boolean;
}

export function useCommunityFeed(channel: FeedChannel, region: { state?: string | null; city?: string | null }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("community_posts")
      .select("*")
      .eq("channel", channel)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (channel === "regional") {
      if (!region.state) { setPosts([]); setLoading(false); return; }
      q = q.eq("state", region.state);
      if (region.city) q = q.eq("city", region.city);
    }

    const { data: rawPosts } = await q;
    const list = (rawPosts ?? []) as any[];
    if (list.length === 0) { setPosts([]); setLoading(false); return; }

    const ids = list.map((p) => p.id);
    const [{ data: likes }, { data: comments }, { data: myLikes }] = await Promise.all([
      supabase.from("community_likes").select("post_id").in("post_id", ids),
      supabase.from("community_comments").select("post_id").in("post_id", ids).eq("is_deleted", false),
      supabase.from("community_likes").select("post_id").in("post_id", ids).eq("user_id", user.id),
    ]);

    const likeCount = new Map<string, number>();
    (likes ?? []).forEach((l: any) => likeCount.set(l.post_id, (likeCount.get(l.post_id) ?? 0) + 1));
    const commentCount = new Map<string, number>();
    (comments ?? []).forEach((c: any) => commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1));
    const mine = new Set((myLikes ?? []).map((l: any) => l.post_id));

    setPosts(list.map((p) => ({
      ...p,
      likes_count: likeCount.get(p.id) ?? 0,
      comments_count: commentCount.get(p.id) ?? 0,
      liked_by_me: mine.has(p.id),
    })));
    setLoading(false);
  }, [user, channel, region.state, region.city]);

  useEffect(() => { load(); }, [load]);

  // realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`feed-${channel}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_posts", filter: `channel=eq.${channel}` },
        () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_likes" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, channel, load]);

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    // optimistic
    setPosts((prev) => prev.map((p) => p.id === postId ? {
      ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1)
    } : p));
    if (post.liked_by_me) {
      await supabase.from("community_likes").delete().eq("user_id", user.id).eq("post_id", postId);
    } else {
      await supabase.from("community_likes").insert({ user_id: user.id, post_id: postId });
    }
  };

  return { posts, loading, reload: load, toggleLike };
}
