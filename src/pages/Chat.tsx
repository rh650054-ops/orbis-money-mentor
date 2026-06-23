import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/shared/ui/use-toast";
import { useCommunityFeed, type FeedPost } from "@/hooks/useCommunityFeed";
import { PostComposer } from "@/components/community/PostComposer";
import { PostCard } from "@/components/community/PostCard";
import { CommentsSheet } from "@/components/community/CommentsSheet";
import { generatePostShareImage } from "@/components/community/postShareImage";

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<{ nickname: string | null; avatar_url: string | null; city: string | null; state: string | null } | null>(null);
  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("nickname, avatar_url, city, state")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setProfile(data);
  }, [user]);
  useEffect(() => { loadProfile(); }, [loadProfile]);

  const { posts, loading, reload, toggleLike } = useCommunityFeed();

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("community_posts").update({ is_deleted: true }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao apagar post", description: error.message, variant: "destructive" });
      return;
    }
    reload();
  };

  const handleShare = async (post: FeedPost) => {
    try {
      const blob = await generatePostShareImage(post);
      if (!blob) throw new Error("Falha ao gerar imagem");
      const file = new File([blob], "orbis-comunidade.png", { type: "image/png" });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Comunidade Orbis" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "orbis-comunidade.png";
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Imagem baixada", description: "Agora é só postar no Instagram!" });
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      toast({ title: "Erro ao gerar imagem", description: e?.message, variant: "destructive" });
    }
  };

  const handleRepost = async (post: FeedPost) => {
    if (!user) return;
    if (post.user_id === user.id) {
      toast({ title: "Esse post já é seu" });
      return;
    }
    const quoted = `🔁 Repost de @${post.nickname ?? "vendedor"}:\n\n${post.content ?? ""}`.slice(0, 1000);
    const { error } = await supabase.from("community_posts").insert({
      user_id: user.id,
      channel: "global",
      content: quoted,
      image_url: post.image_url ?? null,
      city: null,
      state: null,
      nickname: profile?.nickname ?? user.email?.split("@")[0] ?? "Vendedor",
      avatar_url: profile?.avatar_url ?? null,
    });
    if (error) {
      toast({ title: "Erro ao repostar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Repostado!", description: "Apareceu no feed da comunidade." });
    reload();
  };

  return (
    <div className="mx-auto w-full max-w-xl pb-4">
      <div className="mb-3 px-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Comunidade Orbis</h1>
        <p className="text-sm text-muted-foreground">Feed de vendedores na ativa</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/30">
        <PostComposer channel="global" profile={profile} onPosted={reload} />

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            Seja o primeiro a postar! 🚀
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                isMine={p.user_id === user?.id}
                onLike={() => toggleLike(p.id)}
                onOpenComments={() => setOpenCommentsFor(p.id)}
                onShare={() => handleShare(p)}
                onRepost={() => handleRepost(p)}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      <CommentsSheet
        postId={openCommentsFor}
        onClose={() => { setOpenCommentsFor(null); reload(); }}
        profile={profile}
      />
    </div>
  );
}
