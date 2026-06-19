import { useState, useEffect, useCallback } from "react";
import { Globe, MapPin, Loader2, Settings } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/shared/ui/use-toast";
import { useCommunityFeed, type FeedChannel, type FeedPost } from "@/hooks/useCommunityFeed";
import { PostComposer } from "@/components/community/PostComposer";
import { PostCard } from "@/components/community/PostCard";
import { CommentsSheet } from "@/components/community/CommentsSheet";
import { generatePostShareImage } from "@/components/community/postShareImage";

const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [channel, setChannel] = useState<FeedChannel>("global");
  const [profile, setProfile] = useState<{ nickname: string | null; avatar_url: string | null; city: string | null; state: string | null } | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("nickname, avatar_url, city, state")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setProfile(data);
      setEditCity(data.city || "");
      setEditState(data.state || "");
    }
  }, [user]);
  useEffect(() => { loadProfile(); }, [loadProfile]);

  const { posts, loading, reload, toggleLike } = useCommunityFeed(
    channel,
    { state: profile?.state, city: profile?.city }
  );

  const saveRegion = async () => {
    if (!user) return;
    const payload = { city: editCity.trim() || null, state: editState || null };
    const { error } = await supabase.from("profiles").update(payload).eq("user_id", user.id);
    if (error) { toast({ title: "Erro ao salvar região", variant: "destructive" }); return; }
    setProfile((p) => (p ? { ...p, ...payload } : p));
    setSetupOpen(false);
    toast({ title: "Região salva!" });
  };

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
      channel,
      content: quoted,
      image_url: post.image_url ?? null,
      city: channel === "regional" ? profile?.city ?? null : null,
      state: channel === "regional" ? profile?.state ?? null : null,
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
    <div className="min-h-[calc(100dvh-9rem)] md:min-h-[calc(100vh-4rem)] pb-4">
      <div className="mb-3">
        <h1 className="text-2xl font-bold">Comunidade Orbis</h1>
        <p className="text-sm text-muted-foreground">Feed de vendedores na ativa</p>
      </div>

      <Tabs value={channel} onValueChange={(v) => setChannel(v as FeedChannel)} className="w-full">
        <TabsList className="grid grid-cols-2 w-full mb-3">
          <TabsTrigger value="global" className="gap-2"><Globe className="h-4 w-4" /> Global</TabsTrigger>
          <TabsTrigger value="regional" className="gap-2">
            <MapPin className="h-4 w-4" />
            {profile?.city ? profile.city : profile?.state ? profile.state : "Regional"}
          </TabsTrigger>
        </TabsList>

        {(["global","regional"] as FeedChannel[]).map((ch) => (
          <TabsContent key={ch} value={ch} className="mt-0 space-y-3 data-[state=inactive]:hidden">
            {ch === "regional" && !profile?.state ? (
              <div className="bg-card border border-border/60 rounded-xl p-8 flex flex-col items-center text-center gap-3">
                <MapPin className="h-10 w-10 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold mb-1">Defina sua região</h3>
                  <p className="text-sm text-muted-foreground">Para ver posts dos vendedores próximos.</p>
                </div>
                <Button onClick={() => setSetupOpen(true)} className="bg-gradient-primary">
                  <Settings className="h-4 w-4 mr-2" /> Configurar região
                </Button>
              </div>
            ) : (
              <>
                <PostComposer channel={ch} profile={profile} onPosted={reload} />

                {loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : posts.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    Nenhum post ainda. Comece você!
                  </p>
                ) : (
                  posts.map((p) => (
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
                  ))
                )}

                {ch === "regional" && profile?.state && (
                  <button
                    onClick={() => setSetupOpen(true)}
                    className="text-xs text-muted-foreground mx-auto block hover:text-foreground mt-2"
                  >
                    Trocar região
                  </button>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <CommentsSheet
        postId={openCommentsFor}
        onClose={() => { setOpenCommentsFor(null); reload(); }}
        profile={profile}
      />

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Sua região</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Estado (UF)</Label>
              <Select value={editState} onValueChange={setEditState}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {BR_STATES.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cidade (opcional)</Label>
              <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="Ex: São Paulo" />
              <p className="text-xs text-muted-foreground mt-1">Sem cidade, você verá o feed estadual.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSetupOpen(false)}>Cancelar</Button>
            <Button onClick={saveRegion} disabled={!editState} className="bg-gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
