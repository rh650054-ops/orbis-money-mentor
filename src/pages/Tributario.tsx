import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Landmark, AlertTriangle, CheckCircle2, CalendarClock, FileText, ExternalLink, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/shared/lib/utils";
import { getBrazilDate } from "@/shared/lib/date-utils";

// Valores oficiais — MANTER ATUALIZÁVEIS (mudam com o salário mínimo / lei).
const LIMITE_MEI_ANO = 81000; // teto vigente em jul/2026 (propostas de aumento não aprovadas)
const DAS_2026: Record<string, number> = { comercio: 82.05, servicos: 86.05, misto: 87.05 };
const ATIVIDADES = [
  { key: "comercio", label: "Comércio / Indústria", desc: "vende produtos" },
  { key: "servicos", label: "Serviços", desc: "presta serviço" },
  { key: "misto", label: "Comércio + Serviços", desc: "os dois" },
] as const;

export default function Tributario() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [situacao, setSituacao] = useState<string | null>(null);
  const [atividade, setAtividade] = useState<string>("comercio");
  const [faturamentoAno, setFaturamentoAno] = useState(0);

  const hoje = getBrazilDate();
  const ano = hoje.slice(0, 4);
  const mesAtual = Number(hoje.slice(5, 7));
  const diaAtual = Number(hoje.slice(8, 10));

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: sales }] = await Promise.all([
        supabase.from("profiles").select("tax_situacao, tax_atividade").eq("user_id", user.id).maybeSingle(),
        supabase.from("daily_sales").select("cash_sales, pix_sales, card_sales").eq("user_id", user.id).gte("date", `${ano}-01-01`).lte("date", `${ano}-12-31`),
      ]);
      const p = prof as { tax_situacao?: string; tax_atividade?: string } | null;
      setSituacao(p?.tax_situacao ?? null);
      setAtividade(p?.tax_atividade ?? "comercio");
      const total = (sales || []).reduce(
        (s, r) => s + (Number(r.cash_sales) || 0) + (Number(r.pix_sales) || 0) + (Number(r.card_sales) || 0),
        0,
      );
      setFaturamentoAno(total);
      setLoading(false);
    })();
  }, [user, ano]);

  const salvarPerfil = async (novaSituacao: string, novaAtividade: string) => {
    if (!user) return;
    setSaving(true);
    setSituacao(novaSituacao);
    setAtividade(novaAtividade);
    await supabase.from("profiles").update({ tax_situacao: novaSituacao, tax_atividade: novaAtividade } as never).eq("user_id", user.id);
    setSaving(false);
  };

  // Painel do limite
  const pct = Math.min(100, (faturamentoAno / LIMITE_MEI_ANO) * 100);
  const restante = Math.max(0, LIMITE_MEI_ANO - faturamentoAno);
  const projecaoAno = mesAtual > 0 ? (faturamentoAno / mesAtual) * 12 : 0;
  const vaiPassar = projecaoAno > LIMITE_MEI_ANO;
  // Classes LITERAIS (Tailwind não gera classe montada em runtime).
  const CORES = {
    success: { badge: "bg-success/15 text-success border-success/30", bar: "bg-success" },
    warning: { badge: "bg-warning/15 text-warning border-warning/30", bar: "bg-warning" },
    destructive: { badge: "bg-destructive/15 text-destructive border-destructive/30", bar: "bg-destructive" },
  };
  const cor = pct >= 90 ? CORES.destructive : pct >= 70 ? CORES.warning : CORES.success;

  // DAS do mês
  const dasValor = DAS_2026[atividade] ?? DAS_2026.comercio;
  const dasVenceHoje = diaAtual <= 20;
  const dasDiasRestantes = 20 - diaAtual;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-10">
      <button onClick={() => navigate("/profile")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Perfil
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
          <Landmark className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tributário</h1>
          <p className="text-sm text-muted-foreground">Seu imposto do MEI, sem complicação</p>
        </div>
      </div>

      {/* SETUP — situação + atividade */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold">Qual a sua situação?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => salvarPerfil("mei", atividade)}
              className={`py-2.5 rounded-xl border text-sm font-semibold transition-colors ${situacao === "mei" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
            >
              Já sou MEI
            </button>
            <button
              onClick={() => salvarPerfil("informal", atividade)}
              className={`py-2.5 rounded-xl border text-sm font-semibold transition-colors ${situacao === "informal" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
            >
              Ainda sou informal
            </button>
          </div>

          {situacao === "mei" && (
            <div className="pt-1">
              <p className="text-xs text-muted-foreground mb-2">Sua atividade (define o valor do DAS):</p>
              <div className="grid grid-cols-3 gap-1.5">
                {ATIVIDADES.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => salvarPerfil("mei", a.key)}
                    disabled={saving}
                    className={`py-2 rounded-lg border text-[11px] font-semibold transition-colors ${atividade === a.key ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* INFORMAL — guia de formalização */}
      {situacao === "informal" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Vale a pena virar MEI</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              É <b className="text-foreground">grátis</b> e sai na hora. Você ganha CNPJ, pode emitir nota, contribui pro INSS
              (aposentadoria, auxílio-doença, salário-maternidade) e consegue crédito/conta PJ. Paga só um valor fixo por mês (DAS),
              a partir de <b className="text-foreground">{formatCurrency(DAS_2026.comercio)}</b>.
            </p>
            <p className="text-[11px] text-muted-foreground">Precisa de: conta gov.br (nível prata ou ouro) e CPF. Atividade tem que estar na lista permitida.</p>
            <a href="https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/quero-ser-mei" target="_blank" rel="noopener noreferrer">
              <Button className="w-full">
                Quero me formalizar <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>
          </CardContent>
        </Card>
      )}

      {/* MEI — painel completo */}
      {situacao === "mei" && (
        <>
          {/* Limite anual */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Faturamento do ano ({ano})</p>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${cor.badge}`}>
                  {pct.toFixed(0)}% do limite
                </span>
              </div>
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(faturamentoAno)}</p>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${cor.bar} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                Falta {formatCurrency(restante)} pro teto de {formatCurrency(LIMITE_MEI_ANO)}/ano.
              </p>
              {projecaoAno > 0 && (
                <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed ${vaiPassar ? "bg-destructive/10 border border-destructive/30" : "bg-muted/40 border border-border/40"}`}>
                  {vaiPassar ? <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />}
                  <span className="text-muted-foreground">
                    No seu ritmo, você fecha o ano em <b className={vaiPassar ? "text-destructive" : "text-foreground"}>{formatCurrency(projecaoAno)}</b>.
                    {vaiPassar
                      ? " Isso passa do limite do MEI — cuidado com o desenquadramento (viraria ME no Simples)."
                      : " Dentro do limite do MEI. 👍"}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DAS do mês */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">DAS de {new Date().toLocaleDateString("pt-BR", { month: "long" })}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-primary tracking-tight">{formatCurrency(dasValor)}</p>
                  <p className="text-xs text-muted-foreground">
                    {dasVenceHoje ? (dasDiasRestantes === 0 ? "vence HOJE (dia 20)" : `vence em ${dasDiasRestantes} dia(s) — dia 20`) : "venceu dia 20 — gere a guia atualizada"}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${dasVenceHoje ? "bg-primary/10 text-primary border-primary/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                  {dasVenceHoje ? "a pagar" : "atrasado?"}
                </span>
              </div>
              <a href="https://www8.receita.fazenda.gov.br/SimplesNacional/aplicacoes/atspo/pgmei.app/identificacao" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full">
                  Gerar / pagar o DAS no PGMEI <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </a>
              <p className="text-[11px] text-muted-foreground">Dica: ative o débito automático no App MEI pra nunca atrasar.</p>
            </CardContent>
          </Card>

          {/* DASN anual */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Declaração anual (DASN-SIMEI)</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Uma vez por ano, <b className="text-foreground">até 31 de maio</b>, você declara quanto faturou no ano anterior. É grátis e obrigatória, <b className="text-foreground">mesmo faturando zero</b>. A do ano que vem vai reportar os {formatCurrency(faturamentoAno)} de {ano}.
              </p>
              <a href="https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/Identificacao" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full">
                  Fazer a declaração anual <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </a>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-center text-[11px] text-muted-foreground px-4 leading-relaxed">
        Valores de referência de 2026. O Orbis organiza e lembra, mas o pagamento e a declaração são feitos nos portais oficiais do governo. Casos complexos: procure um contador.
      </p>
    </div>
  );
}
