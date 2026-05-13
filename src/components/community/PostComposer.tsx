import { useState, useRef } from "react";
import { Image as ImageIcon, Loader2, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import type { FeedChannel } from "@/hooks/useCommunityFeed";

interface Props {
  channel: FeedChannel;
  profile: { nickname: string | null; avatar_url: string | null; city: string | null; state: string | null } | null;
  onPosted: () => void;
}

export function PostComposer({ channel, profile, onPosted }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Máx 5MB", variant: "destructive" });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user || (!content.trim() && !file) || sending) return;
    if (channel === "regional" && !profile?.state) {
      toast({ title: "Defina sua região primeiro", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      let image_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("community-media").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        image_url = supabase.storage.from("community-media").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("community_posts").insert({
        user_id: user.id,
        channel,
        content: content.trim().slice(0, 1000),
        image_url,
        city: channel === "regional" ? profile?.city ?? null : null,
        state: channel === "regional" ? profile?.state ?? null : null,
        nickname: profile?.nickname ?? user.email?.split("@")[0] ?? "Vendedor",
        avatar_url: profile?.avatar_url ?? null,
      });
      if (error) throw error;
      setContent(""); setFile(null); setPreview(null);
      onPosted();
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-card border border-border/60 rounded-xl p-3">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-muted text-xs">
            {(profile?.nickname ?? "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={channel === "global" ? "O que está vendendo hoje?" : "Compartilhe com sua região..."}
            maxLength={1000}
            className="min-h-[60px] resize-none border-0 bg-transparent px-0 focus-visible:ring-0 text-sm"
          />
          {preview && (
            <div className="relative inline-block mt-1">
              <img src={preview} alt="" className="max-h-44 rounded-lg border border-border/60" />
              <button
                onClick={() => { setFile(null); setPreview(null); }}
                className="absolute top-1 right-1 bg-background/80 rounded-full p-1 hover:bg-background"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-primary hover:bg-primary/10 rounded-full p-2 transition-colors"
              aria-label="Adicionar imagem"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">{content.length}/1000</span>
              <Button
                size="sm"
                onClick={submit}
                disabled={sending || (!content.trim() && !file)}
                className="rounded-full bg-gradient-primary"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1" /> Postar</>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
