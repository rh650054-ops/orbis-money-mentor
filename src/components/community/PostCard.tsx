import { Heart, MessageCircle, Trash2, Repeat2, Share2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/shared/lib/utils";
import type { FeedPost } from "@/hooks/useCommunityFeed";

interface Props {
  post: FeedPost;
  isMine: boolean;
  onLike: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  onRepost: () => void;
  onDelete: () => void;
}

// Destaca #hashtags e @menções no texto do post
function renderContent(text: string) {
  const parts = text.split(/(#[\p{L}\d_]+|@[\p{L}\d_]+)/gu);
  return parts.map((part, i) =>
    /^[#@]/.test(part) ? (
      <span key={i} className="text-primary font-medium">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function PostCard({ post, isMine, onLike, onOpenComments, onShare, onRepost, onDelete }: Props) {
  return (
    <article className="bg-card border border-border/60 rounded-xl p-3.5">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={post.avatar_url ?? undefined} />
          <AvatarFallback className="bg-muted text-xs">
            {(post.nickname ?? "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm truncate">{post.nickname ?? "Vendedor"}</span>
            {post.city && <span className="text-xs text-muted-foreground truncate">· {post.city}/{post.state}</span>}
            <span className="text-xs text-muted-foreground ml-auto shrink-0">
              {formatDistanceToNow(new Date(post.created_at), { locale: ptBR, addSuffix: false })}
            </span>
          </div>
          {post.content && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{renderContent(post.content)}</p>
          )}
          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              loading="lazy"
              className="mt-2 max-h-96 w-full object-cover rounded-lg border border-border/60"
            />
          )}
          <div className="flex items-center gap-1 mt-2 -ml-2">
            <button
              onClick={onLike}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-3 rounded-full text-xs transition-colors",
                post.liked_by_me
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-label={post.liked_by_me ? "Descurtir" : "Curtir"}
            >
              <Heart className={cn("h-4 w-4", post.liked_by_me && "fill-current")} />
              {post.likes_count > 0 && <span>{post.likes_count}</span>}
            </button>
            <button
              onClick={onOpenComments}
              className="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-3 rounded-full text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Abrir comentários"
            >
              <MessageCircle className="h-4 w-4" />
              {post.comments_count > 0 && <span>{post.comments_count}</span>}
            </button>
            <button
              onClick={onRepost}
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full text-xs text-muted-foreground hover:bg-success/10 hover:text-success transition-colors"
              aria-label="Repostar na comunidade"
            >
              <Repeat2 className="h-4 w-4" />
            </button>
            <button
              onClick={onShare}
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              aria-label="Compartilhar no Instagram"
            >
              <Share2 className="h-4 w-4" />
            </button>
            {isMine && (
              <button
                onClick={onDelete}
                className="ml-auto inline-flex items-center justify-center min-h-11 min-w-11 rounded-full text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                aria-label="Apagar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
