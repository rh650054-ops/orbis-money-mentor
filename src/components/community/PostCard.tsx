import { Heart, MessageCircle, Trash2, Repeat2, Share2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/shared/lib/utils";
import type { FeedPost } from "@/hooks/useCommunityFeed";
import { presenceInfo } from "@/shared/lib/presence";

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
    <article className="px-4 py-3 transition-colors hover:bg-muted/20">
      <div className="flex gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11 ring-1 ring-border/50">
            <AvatarImage src={post.avatar_url ?? undefined} />
            <AvatarFallback className="bg-muted text-xs font-semibold">
              {(post.nickname ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Bolinha: verde = no DEFCON agora, cinza = offline. */}
          <span
            className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background"
            style={{ background: presenceInfo(post.last_active_at).online ? "#22c55e" : "#6b7280" }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-bold truncate">{post.nickname ?? "Vendedor"}</span>
            {post.city && (
              <span className="text-muted-foreground truncate">· {post.city}/{post.state}</span>
            )}
            <span className="text-muted-foreground shrink-0">·</span>
            <span className="text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(post.created_at), { locale: ptBR, addSuffix: false })}
            </span>
            {isMine && (
              <button
                onClick={onDelete}
                className="ml-auto -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Apagar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {post.content && (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {renderContent(post.content)}
            </p>
          )}

          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              loading="lazy"
              className="mt-2.5 max-h-[30rem] w-full rounded-2xl border border-border/60 object-cover"
            />
          )}

          <div className="mt-2 flex max-w-sm items-center justify-between text-muted-foreground">
            <button
              onClick={onLike}
              className={cn(
                "group inline-flex items-center gap-1.5 text-xs transition-colors",
                post.liked_by_me ? "text-rose-500" : "hover:text-rose-500"
              )}
              aria-label={post.liked_by_me ? "Descurtir" : "Curtir"}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors group-hover:bg-rose-500/10">
                <Heart className={cn("h-[18px] w-[18px]", post.liked_by_me && "fill-current")} />
              </span>
              {post.likes_count > 0 && <span>{post.likes_count}</span>}
            </button>

            <button
              onClick={onOpenComments}
              className="group inline-flex items-center gap-1.5 text-xs transition-colors hover:text-sky-500"
              aria-label="Comentários"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors group-hover:bg-sky-500/10">
                <MessageCircle className="h-[18px] w-[18px]" />
              </span>
              {post.comments_count > 0 && <span>{post.comments_count}</span>}
            </button>

            <button
              onClick={onRepost}
              className="group inline-flex items-center gap-1.5 text-xs transition-colors hover:text-success"
              aria-label="Repostar na comunidade"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors group-hover:bg-success/10">
                <Repeat2 className="h-[18px] w-[18px]" />
              </span>
            </button>

            <button
              onClick={onShare}
              className="group inline-flex items-center gap-1.5 text-xs transition-colors hover:text-primary"
              aria-label="Compartilhar no Instagram"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors group-hover:bg-primary/10">
                <Share2 className="h-[18px] w-[18px]" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
