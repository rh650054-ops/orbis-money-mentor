import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, Loader2, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
  likes_count: number;
  liked_by_me: boolean;
}

interface Props {
  postId: string | null;
  onClose: () => void;
  profile: { nickname: string | null; avatar_url: string | null } | null;
}

export function CommentsSheet({ postId, onClose, profile }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!postId || !user) return;
    setLoading(true);
    const { data: rows } = await supabase
      .from("community_comments")
      .select("*")
      .eq("post_id", postId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });
    const list = (rows ?? []) as any[];
    if (list.length === 0) { setComments([]); setLoading(false); return; }
    const ids = list.map((c) => c.id);
    const [{ data: likes }, { data: mine }] = await Promise.all([
      supabase.from("community_likes").select("comment_id").in("comment_id", ids),
      supabase.from("community_likes").select("comment_id").in("comment_id", ids).eq("user_id", user.id),
    ]);
    const lc = new Map<string, number>();
    (likes ?? []).forEach((l: any) => lc.set(l.comment_id, (lc.get(l.comment_id) ?? 0) + 1));
    const myset = new Set((mine ?? []).map((l: any) => l.comment_id));
    setComments(list.map((c) => ({
      ...c,
      likes_count: lc.get(c.id) ?? 0,
      liked_by_me: myset.has(c.id),
    })));
    setLoading(false);
  }, [postId, user]);

  useEffect(() => { if (postId) load(); else setComments([]); }, [postId, load]);

  const send = async () => {
    if (!user || !postId || !text.trim() || sending) return;
    setSending(true);
    await supabase.from("community_comments").insert({
      post_id: postId,
      user_id: user.id,
      content: text.trim().slice(0, 500),
      nickname: profile?.nickname ?? user.email?.split("@")[0] ?? "Vendedor",
      avatar_url: profile?.avatar_url ?? null,
    });
    setText("");
    await load();
    setSending(false);
  };

  const toggleLike = async (c: Comment) => {
    if (!user) return;
    setComments((prev) => prev.map((x) => x.id === c.id ? {
      ...x, liked_by_me: !x.liked_by_me, likes_count: x.likes_count + (x.liked_by_me ? -1 : 1)
    } : x));
    if (c.liked_by_me) {
      await supabase.from("community_likes").delete().eq("user_id", user.id).eq("comment_id", c.id);
    } else {
      await supabase.from("community_likes").insert({ user_id: user.id, comment_id: c.id });
    }
  };

  const remove = async (id: string) => {
    await supabase.from("community_comments").update({ is_deleted: true }).eq("id", id);
    setComments((p) => p.filter((c) => c.id !== id));
  };

  return (
    <Sheet open={!!postId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[85dvh] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/60">
          <SheetTitle className="text-base">Comentários</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">Seja o primeiro a comentar.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={c.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-muted text-xs">
                    {(c.nickname ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="bg-muted/40 rounded-2xl rounded-tl-sm px-3 py-2">
                    <div className="text-xs font-semibold mb-0.5">{c.nickname ?? "Vendedor"}</div>
                    <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 px-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { locale: ptBR, addSuffix: true })}
                    </span>
                    <button onClick={() => toggleLike(c)} className={cn(
                      "inline-flex items-center justify-center gap-1 min-h-11 min-w-11 -my-2 -mx-2 text-xs",
                      c.liked_by_me ? "text-destructive" : "text-muted-foreground hover:text-foreground"
                    )} aria-label={c.liked_by_me ? "Descurtir comentário" : "Curtir comentário"}>
                      <Heart className={cn("h-4 w-4", c.liked_by_me && "fill-current")} />
                      {c.likes_count > 0 && c.likes_count}
                    </button>
                    {c.user_id === user?.id && (
                      <button onClick={() => remove(c.id)} className="inline-flex items-center justify-center min-h-11 min-w-11 -my-2 -mx-2 text-xs text-muted-foreground hover:text-destructive" aria-label="Apagar comentário">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border/60 p-2 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Escreva um comentário..."
            maxLength={500}
            className="flex-1 rounded-full bg-background"
          />
          <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="rounded-full bg-gradient-primary">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
