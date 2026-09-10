/* ============================================================
   DICA DO ORBIS — gerada por IA com os números da própria pessoa.

   Rick (10/09): "as dicas tem que ser com IA". Uma dica por dia, guardada no
   aparelho (localStorage) pra não gastar IA a cada abertura da tela; o botão
   "nova dica" força outra. Se a IA falhar ou estourar o teto do dia, mostra a
   dica local (calculada sem IA) que a tela já tinha — nunca fica em branco.
   ============================================================ */
import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";

export interface DicaContexto {
  hoje: string;
  mediaDia: number;
  sobrouMes: number;
  vendidoMes: number;
  lucroHoje: number;
  fiadoHoje: number;
  guardarHoje: number;
  guardouHoje: number;
  sequencia: number;
  vencidasTotal: number;
  contas: { nome: string; valor: number; guardado: number; diasAteVencer: number | null; porDia: number; vencida: boolean; paga: boolean }[];
  caixinhas: { nome: string; alvo: number; tem: number; porDia: number }[];
}

interface Dica { titulo: string; texto: string; fonte: "ia" | "local"; quando: string }

interface Props {
  userId: string;
  contexto: DicaContexto;
  /** Dica calculada sem IA — usada enquanto a IA carrega e se ela falhar. */
  fallback: { titulo: string; texto: string } | null;
  /** Só gera quando a tela tem o que analisar (evita IA em conta vazia). */
  pronto: boolean;
  onConversar?: () => void;
}

const chave = (userId: string) => `orbis_dica_financas_${userId}`;

/** "YYYY-MM-DD" no fuso do aparelho (a pessoa está no Brasil) — ou "" se a data for inválida. */
function dataLocal(iso: string): string {
  const d = new Date(iso);
  if (!iso || !Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DicaDoOrbis({ userId, contexto, fallback, pronto, onConversar }: Props) {
  const [dica, setDica] = useState<Dica | null>(() => {
    try {
      const raw = localStorage.getItem(chave(userId));
      if (!raw) return null;
      const j = JSON.parse(raw) as Dica;
      return j && j.texto ? j : null;
    } catch { return null; }
  });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gerar = async (forcar: boolean) => {
    if (carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: { type: "financas_dica", ...contexto },
      });
      if (error) throw error;
      const d = data as { titulo?: string; texto?: string; limite?: boolean; error?: string } | null;
      if (!d || d.error) throw new Error(d?.error || "sem resposta");
      if (d.limite) {
        // Teto diário da IA: não sobrescreve a dica boa de hoje, só avisa.
        setErro(d.texto || "A IA já trabalhou bastante hoje.");
        return;
      }
      if (!d.texto) throw new Error("vazia");
      const nova: Dica = { titulo: (d.titulo || "").trim(), texto: d.texto.trim(), fonte: "ia", quando: new Date().toISOString() };
      setDica(nova);
      try { localStorage.setItem(chave(userId), JSON.stringify(nova)); } catch { /* ignore */ }
    } catch (e) {
      console.error("dica financas:", e);
      setErro(forcar ? "Não consegui gerar agora. Tenta de novo em 1 min." : null);
    } finally {
      setCarregando(false);
    }
  };

  // 1x por dia: se a dica guardada não é de hoje, gera outra sozinha.
  useEffect(() => {
    if (!pronto) return;
    if (dica && dataLocal(dica.quando) === getBrazilDate()) return;
    void gerar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto]);

  const mostrando = dica ?? (fallback ? { titulo: fallback.titulo, texto: fallback.texto, fonte: "local" as const, quando: "" } : null);
  if (!mostrando && !carregando) return null;

  const horaLabel = (() => {
    if (!dica?.quando || !dataLocal(dica.quando)) return null;
    const d = new Date(dica.quando);
    const hoje = dataLocal(dica.quando) === getBrazilDate();
    return `${hoje ? "hoje" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${d.getHours()}h`;
  })();

  return (
    <section
      className="orbis-card-in rounded-2xl border p-4 flex flex-col gap-3"
      style={{ borderColor: "rgba(245,184,0,.34)", background: "linear-gradient(180deg,#171203, hsl(var(--card)))" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-[9px] shrink-0" style={{ background: "rgba(245,184,0,.14)" }}>
            <Sparkles className="w-4 h-4" style={{ color: "var(--orbis-gold,#F5B800)" }} strokeWidth={2.2} />
          </span>
          <span className="orbis-label">Dica do Orbis</span>
        </span>
        <span className="text-[11px] font-bold" style={{ color: "var(--orbis-fg-3,#7e7869)" }}>
          {carregando ? "pensando…" : mostrando?.fonte === "ia" && horaLabel ? `lida ${horaLabel}` : mostrando ? "sem IA por enquanto" : ""}
        </span>
      </div>

      {carregando && !mostrando ? (
        <p className="flex items-center gap-2 text-sm py-1" style={{ color: "var(--orbis-fg-2,#b9b3a6)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Lendo suas contas e caixinhas…
        </p>
      ) : mostrando ? (
        <>
          {mostrando.titulo && <p className="text-[15px] font-extrabold leading-[1.3] text-foreground">{mostrando.titulo}</p>}
          <p className="text-[13px] leading-[1.5]" style={{ color: "var(--orbis-fg-2,#b9b3a6)" }}>{mostrando.texto}</p>
        </>
      ) : null}

      {erro && <p className="text-[12px]" style={{ color: "var(--orbis-fg-3,#7e7869)" }}>{erro}</p>}

      <div className="flex items-center gap-3 pt-0.5 text-[12.5px] font-extrabold">
        <button
          type="button"
          onClick={() => gerar(true)}
          disabled={carregando || !pronto}
          className="inline-flex items-center gap-1.5 h-9 disabled:opacity-50"
          style={{ color: "var(--orbis-gold,#F5B800)" }}
        >
          {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.4} />}
          nova dica
        </button>
        {onConversar && (
          <button type="button" onClick={onConversar} className="inline-flex items-center gap-1 h-9 ml-auto" style={{ color: "var(--orbis-fg-2,#b9b3a6)" }}>
            conversar com o mentor <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.4} />
          </button>
        )}
      </div>
    </section>
  );
}
