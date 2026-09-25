import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { toast } from "@/shared/hooks/use-toast";
import { avisar } from "@/shared/lib/avisar";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import { AdminShell } from "@/components/admin/AdminShell";
import { Brain, Plus, RefreshCw, Save, Trash2, Loader2, CloudSun, ChevronDown, ChevronRight } from "lucide-react";

// ============================================================================
// COFRE DE CONHECIMENTO — o "Obsidian da Vant", agora dentro do app.
// Cada nota ATIVA da tabela ai_conhecimento entra no cérebro do mentor de IA
// em toda conversa (bright-action lê via RPC orbis_conhecimento; a categoria
// "padroes" também entra na ficha do vendedor). Editou, salvou, já vale.
// A segurança real está no banco (RLS por is_orbis_admin) — aqui é interface.
// ============================================================================

interface Nota {
  id: number;
  titulo: string;
  categoria: string;
  ordem: number;
  conteudo: string;
  ativo: boolean;
  atualizado_em: string;
}
type Rascunho = Omit<Nota, "id" | "atualizado_em"> & { id: number | null };

/* O que o clima já ensinou pro cérebro (RPC clima_painel, só admin). */
interface PainelClima {
  vendedores: number; vendedores_7d: number; vendedores_hoje: number; dias: number;
  por_estado: { estado: string; dias: number; vendedores: number; media_lucro: number }[];
  top_cidades: { cidade: string; uf: string | null; vendedores: number }[];
}
const NOME_ESTADO: Record<string, string> = { sol: "dia limpo", calor: "calor", nublado: "nublado", chuva: "chuva", tempestade: "tempestade", frio: "frio", noite: "noite" };
const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Teto de caracteres que o banco corta ao montar o bloco do mentor.
const LIMITE = 24000;
const NOVA = (): Rascunho => ({ id: null, titulo: "", categoria: "geral", ordem: 100, conteudo: "", ativo: true });

export default function AdminCofre() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { whitelisted, role, loading: adminLoading } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";

  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [atual, setAtual] = useState<Rascunho | null>(null);
  const [fechadas, setFechadas] = useState<Set<string>>(new Set());
  const [clima, setClima] = useState<PainelClima | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("ai_conhecimento").select("*").order("ordem").order("id");
    if (error) {
      avisar.erro("AdminCofre: carregar notas", error);
      toast({ title: "Não consegui carregar o cofre", description: error.message, variant: "destructive" });
    } else {
      setNotas((data ?? []) as Nota[]);
    }
    setLoading(false);
  };

  const carregarClima = async () => {
    const { data, error } = await supabase.rpc("clima_painel");
    if (error) {
      avisar.silencioso("AdminCofre: clima_painel", error);
      setClima(null);
      return;
    }
    setClima((data ?? null) as PainelClima | null);
  };

  useEffect(() => {
    if (isAdmin) {
      carregar();
      carregarClima();
    }
  }, [user?.id, isAdmin]);

  const porPasta = useMemo(() => {
    const m: Record<string, Nota[]> = {};
    notas.forEach((n) => (m[n.categoria || "geral"] ??= []).push(n));
    return Object.keys(m).sort().map((p) => ({ pasta: p, itens: m[p] ?? [] }));
  }, [notas]);

  const usado = useMemo(
    () => notas.filter((n) => n.ativo).reduce((s, n) => s + (n.titulo?.length || 0) + (n.conteudo?.length || 0) + 6, 0),
    [notas],
  );
  const pct = Math.min(100, Math.round((100 * usado) / LIMITE));

  const imagens = useMemo(() => {
    const txt = atual?.conteudo ?? "";
    return [...txt.matchAll(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)/gi)].map((m) => m[0]).slice(0, 8);
  }, [atual?.conteudo]);

  const abrir = (n: Nota) => setAtual({ id: n.id, titulo: n.titulo, categoria: n.categoria || "geral", ordem: n.ordem ?? 100, conteudo: n.conteudo || "", ativo: !!n.ativo });
  const togglePasta = (p: string) =>
    setFechadas((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });

  const salvar = async () => {
    if (!atual) return;
    const linha = {
      titulo: atual.titulo.trim(),
      categoria: (atual.categoria.trim() || "geral").toLowerCase(),
      ordem: Number(atual.ordem) || 100,
      conteudo: atual.conteudo.trim(),
      ativo: atual.ativo,
      atualizado_em: new Date().toISOString(),
    };
    if (!linha.titulo || !linha.conteudo) {
      toast({ title: "Título e conteúdo são obrigatórios.", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const r = atual.id
      ? await supabase.from("ai_conhecimento").update(linha).eq("id", atual.id).select().single()
      : await supabase.from("ai_conhecimento").insert(linha).select().single();
    setSalvando(false);
    if (r.error) {
      avisar.usuario("Não consegui salvar a nota. Tenta de novo.", r.error, "AdminCofre: salvar nota");
      return;
    }
    toast({ title: "Salvo — o mentor já está lendo esta versão" });
    const salva = r.data as Nota;
    await carregar();
    abrir(salva);
  };

  const apagar = async () => {
    if (!atual) return;
    if (!atual.id) {
      setAtual(null);
      return;
    }
    if (!window.confirm(`Apagar a nota "${atual.titulo}"? O mentor deixa de saber isso.`)) return;
    const { error } = await supabase.from("ai_conhecimento").delete().eq("id", atual.id);
    if (error) {
      avisar.usuario("Não consegui apagar a nota. Tenta de novo.", error, "AdminCofre: apagar nota");
      return;
    }
    toast({ title: "Nota apagada." });
    setAtual(null);
    await carregar();
  };

  // ---- guarda de acesso ----
  if (authLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="text-center py-20 px-6 max-w-2xl mx-auto">
        <p className="text-5xl mb-3">🔒</p>
        <p className="text-foreground font-bold">Área restrita</p>
        <p className="text-sm text-muted-foreground mt-1">Só administradores da Vant entram aqui.</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate("/profile")}>Voltar ao perfil</Button>
      </div>
    );
  }

  return (
    <AdminShell
      title="Cofre de Conhecimento"
      subtitle="Tudo que estiver ativo aqui é lido pelo mentor em toda conversa — vale no minuto seguinte, sem publicar nada."
      icon={<Brain className="w-6 h-6 text-violet-400" />}
      actions={
        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="icon" onClick={carregar} aria-label="Recarregar" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setAtual(NOVA())} className="gap-1">
            <Plus className="w-4 h-4" /> Nova nota
          </Button>
        </div>
      }
    >
      {/* Orçamento do cérebro */}
      <div className="rounded-xl border border-border bg-card/40 px-3 py-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{pct}% do espaço no cérebro usado</span>
          <span className="tabular-nums">{usado.toLocaleString("pt-BR")} / {LIMITE.toLocaleString("pt-BR")} letras</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
          <div className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : "bg-violet-500"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Editor */}
      {atual && (
        <Card className="border-violet-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{atual.id ? "Editar nota" : "Nova nota"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={atual.titulo} onChange={(e) => setAtual({ ...atual, titulo: e.target.value })} placeholder="Título da nota" className="font-bold" />
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                pasta
                <Input value={atual.categoria} onChange={(e) => setAtual({ ...atual, categoria: e.target.value })} placeholder="geral" className="h-8 w-32 text-xs" />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                ordem
                <Input type="number" value={atual.ordem} onChange={(e) => setAtual({ ...atual, ordem: Number(e.target.value) || 0 })} className="h-8 w-20 text-xs text-center" />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground ml-auto">
                no cérebro
                <Switch checked={atual.ativo} onCheckedChange={(v) => setAtual({ ...atual, ativo: v })} />
              </label>
            </div>
            <Textarea
              value={atual.conteudo}
              onChange={(e) => setAtual({ ...atual, conteudo: e.target.value })}
              rows={10}
              placeholder="O conhecimento em si. Escreva como quem ensina um vendedor novo do time: direto, com números e exemplos. Links de imagem (.png/.jpg) aparecem aqui embaixo."
              className="text-sm leading-relaxed"
            />
            {imagens.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {imagens.map((u) => (
                  <img key={u} src={u} alt="" className="h-20 rounded-lg border border-border" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={salvar} disabled={salvando} className="gap-1.5">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
              </Button>
              <Button variant="outline" onClick={apagar} className="gap-1.5 text-destructive border-destructive/40">
                <Trash2 className="w-4 h-4" /> {atual.id ? "Apagar" : "Descartar"}
              </Button>
              <span className="ml-auto text-[10px] text-muted-foreground">◈ lida pelo mentor em toda conversa</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Árvore de pastas */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-card/40 border border-border/50 animate-pulse" />)}
        </div>
      ) : notas.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">O cofre está vazio. Crie a primeira nota.</p>
      ) : (
        <div className="space-y-2">
          {porPasta.map(({ pasta, itens }) => {
            const fechada = fechadas.has(pasta);
            return (
              <div key={pasta} className="rounded-xl border border-border bg-card/40">
                <button type="button" onClick={() => togglePasta(pasta)} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {fechada ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {pasta}
                  <span className="ml-auto opacity-60">{itens.length}</span>
                </button>
                {!fechada && (
                  <div className="px-2 pb-2 space-y-1">
                    {itens.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => abrir(n)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                          atual?.id === n.id ? "bg-violet-500/15 border-violet-500/40 text-violet-300" : "bg-card border-border/60 text-foreground"
                        } ${n.ativo ? "" : "opacity-60 line-through"}`}
                      >
                        <span className="opacity-60 mr-1.5">◈</span>{n.titulo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CLIMA DO VENDEDOR — leitura, não edição: é o que o app aprendeu sozinho. */}
      {clima && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <CloudSun className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">Clima do vendedor — o que o app aprendeu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[["usaram", clima.vendedores], ["nos 7 dias", clima.vendedores_7d], ["hoje", clima.vendedores_hoje]].map(([r, v]) => (
                <div key={String(r)} className="rounded-lg border p-2 text-center">
                  <p className="text-lg font-bold leading-none">{String(v)}</p>
                  <p className="text-[10.5px] text-muted-foreground mt-1">{String(r)}</p>
                </div>
              ))}
            </div>
            {clima.por_estado.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Média vendida por tempo</p>
                {[...clima.por_estado].sort((a, b) => b.media_lucro - a.media_lucro).map((e) => (
                  <div key={e.estado} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <span className="font-medium">{NOME_ESTADO[e.estado] ?? e.estado}</span>
                    <span className="text-muted-foreground">{e.dias} dias · {e.vendedores} vendedores</span>
                    <span className="font-bold">{moeda(Number(e.media_lucro) || 0)}</span>
                  </div>
                ))}
              </div>
            )}
            {clima.top_cidades.length > 0 && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Cidades: {clima.top_cidades.map((c) => `${c.cidade}${c.uf ? `/${c.uf}` : ""} (${c.vendedores})`).join(" · ")}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Uma linha por vendedor por dia, com o tempo mais severo daquele dia cruzado com o que ele vendeu. Quanto mais dias, mais firme fica o "você vende X% menos na chuva" que aparece pra ele.
            </p>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
