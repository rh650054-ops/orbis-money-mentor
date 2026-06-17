import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Brain, Save, ArrowLeft, Shield, Loader2 } from "lucide-react";

interface BrainSection {
  id: string;
  key: string;
  title: string;
  content: string;
  sort_order: number;
  enabled: boolean;
}

export default function AdminBrain() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sections, setSections] = useState<BrainSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) checkAdminRole();
  }, [user, loading, navigate]);

  useEffect(() => {
    if (isAdmin) loadSections();
  }, [isAdmin]);

  const checkAdminRole = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();
      setIsAdmin(!!data);
    } catch {
      setIsAdmin(false);
    }
  };

  const loadSections = async () => {
    setLoadingSections(true);
    const { data, error } = await supabase
      .from("ai_brain" as never)
      .select("id, key, title, content, sort_order, enabled")
      .order("sort_order", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setSections((data as unknown as BrainSection[]) || []);
    }
    setLoadingSections(false);
  };

  const updateLocal = (id: string, patch: Partial<BrainSection>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const saveSection = async (s: BrainSection) => {
    setSavingId(s.id);
    const { error } = await supabase
      .from("ai_brain" as never)
      .update({
        content: s.content,
        enabled: s.enabled,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("id", s.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Não salvou", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo", description: `Seção "${s.title}" atualizada. Vale na próxima mensagem da IA.` });
    }
  };

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-5 pt-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Cérebro da Orbis IA</h1>
            <p className="text-xs text-muted-foreground">O que a IA sabe. Editou e salvou, já vale na próxima conversa.</p>
          </div>
        </div>
      </div>

      {loadingSections ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((s) => (
            <Card key={s.id} className={s.enabled ? "" : "opacity-60"}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm">{s.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{s.enabled ? "Ativa" : "Desativada"}</span>
                  <Switch checked={s.enabled} onCheckedChange={(v) => updateLocal(s.id, { enabled: v })} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={s.content}
                  onChange={(e) => updateLocal(s.id, { content: e.target.value })}
                  rows={Math.min(16, Math.max(4, s.content.split("\n").length + 1))}
                  className="text-xs font-mono leading-relaxed"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => saveSection(s)} disabled={savingId === s.id} className="gap-2">
                    {savingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {sections.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhuma seção ainda. Rode a migration do ai_brain no Supabase pra popular.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
