import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Globe, MapPin, Loader2, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Channel = "global" | "regional";

interface ChatMsg {
  id: string;
  user_id: string;
  channel: Channel;
  city: string | null;
  state: string | null;
  nickname: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [channel, setChannel] = useState<Channel>("global");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [profile, setProfile] = useState<{ nickname: string | null; avatar_url: string | null; city: string | null; state: string | null } | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nickname, avatar_url, city, state")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setEditCity(data.city || "");
          setEditState(data.state || "");
        }
      });
  }, [user]);

  // Load messages for current channel
  const loadMessages = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    let q = supabase
      .from("chat_messages")
      .select("*")
      .eq("channel", channel)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(80);

    if (channel === "regional") {
      if (!profile?.state) {
        setMessages([]);
        setIsLoading(false);
        return;
      }
      q = q.eq("state", profile.state);
      if (profile.city) q = q.eq("city", profile.city);
    }

    const { data, error } = await q;
    if (error) {
      console.error(error);
    } else {
      setMessages((data as ChatMsg[]).reverse());
    }
    setIsLoading(false);
  }, [user, channel, profile?.state, profile?.city]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [messages]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channelSub = supabase
      .channel(`chat-${channel}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel=eq.${channel}` },
        (payload) => {
          const m = payload.new as ChatMsg;
          if (channel === "regional") {
            if (profile?.state && m.state !== profile.state) return;
            if (profile?.city && m.city && m.city !== profile.city) return;
          }
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channelSub); };
  }, [user, channel, profile?.state, profile?.city]);

  const handleSend = async () => {
    if (!user || !input.trim() || isSending) return;
    if (channel === "regional" && !profile?.state) {
      setSetupOpen(true);
      return;
    }
    setIsSending(true);
    const text = input.trim().slice(0, 500);
    const payload = {
      user_id: user.id,
      channel,
      city: channel === "regional" ? profile?.city ?? null : null,
      state: channel === "regional" ? profile?.state ?? null : null,
      nickname: profile?.nickname ?? user.email?.split("@")[0] ?? "Vendedor",
      avatar_url: profile?.avatar_url ?? null,
      content: text,
    };
    const { error } = await supabase.from("chat_messages").insert(payload);
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      setInput("");
    }
    setIsSending(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("chat_messages").update({ is_deleted: true }).eq("id", id);
    if (!error) setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const saveRegion = async () => {
    if (!user) return;
    const payload = { city: editCity.trim() || null, state: editState || null };
    const { error } = await supabase.from("profiles").update(payload).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro ao salvar região", variant: "destructive" });
      return;
    }
    setProfile((p) => (p ? { ...p, ...payload } : p));
    setSetupOpen(false);
    toast({ title: "Região salva!", description: "Bem-vindo ao chat regional." });
  };

  return (
    <div className="h-[calc(100dvh-9rem)] md:h-[calc(100vh-4rem)] flex flex-col pb-2">
      <div className="mb-3">
        <h1 className="text-2xl font-bold">Comunidade Orbis</h1>
        <p className="text-sm text-muted-foreground">Converse com outros vendedores</p>
      </div>

      <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-2 w-full mb-3">
          <TabsTrigger value="global" className="gap-2"><Globe className="h-4 w-4" /> Global</TabsTrigger>
          <TabsTrigger value="regional" className="gap-2">
            <MapPin className="h-4 w-4" />
            {profile?.city ? profile.city : profile?.state ? profile.state : "Regional"}
          </TabsTrigger>
        </TabsList>

        {(["global", "regional"] as Channel[]).map((ch) => (
          <TabsContent key={ch} value={ch} className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <div className="flex-1 flex flex-col bg-card/40 border border-border/60 rounded-xl overflow-hidden">
              {ch === "regional" && !profile?.state ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                  <MapPin className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold mb-1">Defina sua região</h3>
                    <p className="text-sm text-muted-foreground">Para conversar com vendedores da sua área.</p>
                  </div>
                  <Button onClick={() => setSetupOpen(true)} className="bg-gradient-primary">
                    <Settings className="h-4 w-4 mr-2" /> Configurar região
                  </Button>
                </div>
              ) : (
                <>
                  <ScrollArea className="flex-1" ref={scrollRef}>
                    <div className="p-3 space-y-3">
                      {isLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      ) : messages.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-10">
                          Nenhuma mensagem ainda. Seja o primeiro!
                        </p>
                      ) : (
                        messages.map((m) => {
                          const isMine = m.user_id === user?.id;
                          return (
                            <div key={m.id} className={cn("flex gap-2", isMine ? "justify-end" : "justify-start")}>
                              {!isMine && (
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-xs bg-muted">
                                    {(m.nickname ?? "?").slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div className={cn("max-w-[78%] flex flex-col", isMine ? "items-end" : "items-start")}>
                                {!isMine && (
                                  <div className="flex items-center gap-1.5 mb-0.5 px-1">
                                    <span className="text-xs font-medium text-foreground">{m.nickname ?? "Vendedor"}</span>
                                    {m.city && <span className="text-[10px] text-muted-foreground">· {m.city}/{m.state}</span>}
                                  </div>
                                )}
                                <div className={cn(
                                  "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                                  isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
                                )}>
                                  {m.content}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 px-1">
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(m.created_at), { locale: ptBR, addSuffix: true })}
                                  </span>
                                  {isMine && (
                                    <button onClick={() => handleDelete(m.id)} className="text-[10px] text-muted-foreground hover:text-destructive">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>

                  <div className="border-t border-border/60 p-2 flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={ch === "global" ? "Mensagem para todos os vendedores..." : "Mensagem para sua região..."}
                      maxLength={500}
                      disabled={isSending}
                      className="flex-1 rounded-full bg-background"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={isSending || !input.trim()}
                      size="icon"
                      className="rounded-full bg-gradient-primary hover:opacity-90"
                    >
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {ch === "regional" && profile?.state && (
              <button
                onClick={() => setSetupOpen(true)}
                className="text-xs text-muted-foreground mt-2 hover:text-foreground self-center"
              >
                Trocar região
              </button>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Region setup dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sua região</DialogTitle>
          </DialogHeader>
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
              <p className="text-[11px] text-muted-foreground mt-1">Sem cidade, você verá o chat estadual.</p>
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
