import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Landmark, CalendarClock, FileText, ExternalLink, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/shared/lib/utils";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { FaturamentoAnoCard } from "@/components/tributario/FaturamentoAnoCard";

// Valores oficiais — MANTER ATUALIZÁVEIS (mudam com o salário mínimo / lei). O teto do MEI mora no FaturamentoAnoCard.
const DAS_2026: Record<string, number> & { comercio: number } = { comercio: 82.05, servicos: 86.05, misto: 87.05 };
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

  const hoje = getBrazilDate();
  const ano = hoje.slice(0, 4);
  const diaAtual = Number(hoje.slice(8, 10));

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase.from("profiles").select("tax_situacao, tax_atividade").eq("user_id", user.id).maybeSingle();
      const p = prof as { tax_situacao?: string; tax_atividade?: string } | null;
      setSituacao(p?.tax_situacao ?? null);
      setAtividade(p?.tax_atividade ?? "comercio");
      setLoading(false);
    })();
  }, [user, ano]);

  const salvarPerfil = async (novaSituacao: string, novaAtividade: string) => {
    if (!user) return;
    setSaving(true);
    setSituacao(novaSituacao);
    setAtividade(novaAtividade);
    const { error } = await supabase.from("profiles").update({ tax_situacao: novaSituacao, tax_atividade: novaAtividade } as never).eq("user_id", user.id);
    if (error) avisar.usuario("Não consegui salvar sua situação tributária. Tenta de novo.", error, "Tributario: salvar perfil");
    setSaving(false);
  };

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
          <FaturamentoAnoCard userId={user?.id} />

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
                Uma vez por ano, <b className="text-foreground">até 31 de maio</b>, você declara quanto faturou no ano anterior. É grátis e obrigatória, <b className="text-foreground">mesmo faturando zero</b>. A do ano que vem vai reportar o faturamento de {ano} que aparece acima.
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
        Valores de referência de 2026. A Vant organiza e lembra, mas o pagamento e a declaração são feitos nos portais oficiais do governo. Casos complexos: procure um contador.
      </p>
    </div>
  );
}
