/* ============================================================
   DEFCON TOUR — o "treino guiado" do DEFCON 4 (pedido do Rick, 01/09).
   Roda em /defcon?treino=1: o DEFCON em memória (useDefconOnboarding),
   nada grava no banco, nada conta no ranking. Este componente desenha
   um HOLOFOTE (spotlight) em cima de cada parte da tela REAL e explica,
   em uma frase, o que é e como usar: missão, relógio, placar,
   abordagem, venda (com venda de teste), anti-calote, gorjeta, custo,
   ocorrência, pausa e encerrar.

   Como funciona:
   - Cada passo aponta pra um `data-tour="defcon-…"` que existe no
     DefconRunning/DefconStartScreen. A cada 250ms medimos o elemento
     (getBoundingClientRect) e posicionamos o recorte + o balão.
   - Passo "explicativo": véu escuro com o recorte iluminado e botão
     "Próximo". Passo "interativo" (espera): SEM véu, só o anel dourado
     pulsando e o balão fora do caminho — o usuário toca de verdade no
     botão real (abordagem, venda) e o tour avança sozinho quando o
     contador muda.
   - Elemento não encontrado (ex.: venda rápida vazia) → pula o passo.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

type Espera = "inicio" | "abordagem" | "venda";

interface Passo {
  anchor: string;
  rotulo: string;
  titulo: string;
  texto: string;
  espera?: Espera;    // passo interativo: avança quando a ação acontece
  dica?: string;      // o que o usuário precisa tocar
  cta?: string;       // texto do botão (padrão "Próximo")
}

const PASSO_INICIO: Passo = {
  anchor: "defcon-iniciar", rotulo: "Treino", titulo: "Isso aqui é um treino",
  texto: "Nada que você fizer nesta tela vai pro ranking nem pro seu faturamento. É só pra você conhecer o DEFCON 4 sem medo.",
  espera: "inicio", dica: "Toca em INICIAR DEFCON 4",
};

const PASSOS: Passo[] = [
  { anchor: "defcon-missao", rotulo: "Missão", titulo: "Sua missão de hoje",
    texto: "Quanto falta pra meta do dia. Cada venda que você registra diminui esse número na hora." },
  { anchor: "defcon-timer", rotulo: "Relógio", titulo: "O relógio do bloco",
    texto: "O dia é dividido em blocos de 1 hora. O relógio mostra quanto falta nesta hora — é o seu ritmo, não uma pressão." },
  { anchor: "defcon-placar", rotulo: "Placar", titulo: "Placar da hora",
    texto: "Quanto vendeu, quantas vendas e quantas abordagens neste bloco. Tocando em Vendas você vê a lista e corrige o que precisar." },
  { anchor: "defcon-abordagem", rotulo: "Abordagem", titulo: "Abordagem = um toque",
    texto: "Chamou alguém pra oferecer? Toca aqui. Abordagem conta mesmo sem venda — é ela que mostra seu esforço e sua conversão.",
    espera: "abordagem", dica: "Toca em Abordagem pra continuar" },
  { anchor: "defcon-venda", rotulo: "Venda", titulo: "Vendeu? Registra em 2 toques",
    texto: "Toca em Venda, digita o valor e escolhe como recebeu: Dinheiro, Pix ou Cartão. Faz uma venda de teste agora — aqui é treino, nada vai pro ranking.",
    espera: "venda", dica: "Registra uma venda de teste" },
  { anchor: "defcon-venda", rotulo: "Anti-calote", titulo: "Modo anti-calote",
    texto: "Cliente vai pagar depois? Dentro de Venda, toca em “Adicionar cliente”, põe o WhatsApp e usa “Registrar e cobrar no WhatsApp”. A cobrança sai pronta com sua chave Pix e a venda fica marcada como “Pix depois” até cair." },
  { anchor: "defcon-gorjeta", rotulo: "Gorjeta", titulo: "Ganhou um extra?",
    texto: "Registra a gorjeta aqui. Ela entra no faturamento do dia, separada das vendas." },
  { anchor: "defcon-custo", rotulo: "Custo", titulo: "Anota o que gastou",
    texto: "Mercadoria, transporte, comida. É assim que o Orbis mostra seu lucro de verdade — não só o que entrou." },
  { anchor: "defcon-ocorrencia", rotulo: "Ocorrência", titulo: "Aconteceu algo?",
    texto: "Chuva, calote tentado, ponto fraco de movimento. Marca aqui e fica no seu histórico pra você entender seus dias." },
  { anchor: "defcon-pausar", rotulo: "Pausa", titulo: "Hora do almoço",
    texto: "Pausa quantas vezes precisar. Você escolhe os minutos e o Orbis te chama de volta." },
  { anchor: "defcon-encerrar", rotulo: "Encerrar", titulo: "Fechou o corre?",
    texto: "Toca em Encerrar e o Orbis mostra seu resumo: vendido, recebido, lucro e o que ficou pra receber. Aqui no treino, é só concluir.",
    cta: "Concluir treino" },
];

interface Rect { top: number; left: number; width: number; height: number }

function medir(anchor: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function DefconTour({ phase, totalApproaches, totalSalesCount, onConcluir }: {
  phase: string;
  totalApproaches: number;
  totalSalesCount: number;
  onConcluir: () => void;
}) {
  const rodando = phase === "running";
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tentativas, setTentativas] = useState(0);
  // uma folha (venda/gorjeta/ocorrência) está aberta em cima da tela? então o
  // balão sai do caminho e vira só uma tarja no topo — o usuário precisa da folha inteira
  const [folhaAberta, setFolhaAberta] = useState(false);

  const passo: Passo | null = rodando ? (PASSOS[idx] ?? null) : phase === "idle" ? PASSO_INICIO : null;

  // marca de onde partimos nos passos interativos (avança quando o contador cresce)
  const [base, setBase] = useState<{ ab: number; vd: number }>({ ab: 0, vd: 0 });
  useEffect(() => { setBase({ ab: totalApproaches, vd: totalSalesCount }); }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!passo) return;
    if (passo.espera === "abordagem" && totalApproaches > base.ab) setTimeout(() => setIdx((i) => i + 1), 450);
    if (passo.espera === "venda" && totalSalesCount > base.vd) setTimeout(() => setIdx((i) => i + 1), 650);
  }, [totalApproaches, totalSalesCount, passo, base]);

  // mede a âncora do passo atual (a tela muda de tamanho, rola, anima…)
  useEffect(() => {
    if (!passo) return;
    let vivo = true;
    const tick = () => {
      if (!vivo) return;
      const r = medir(passo.anchor);
      setRect(r);
      if (!r) setTentativas((t) => t + 1); else setTentativas(0);
      setFolhaAberta(Boolean(document.querySelector('[role="dialog"]:not([data-orbis-tour])')));
    };
    tick();
    const id = window.setInterval(tick, 250);
    window.addEventListener("resize", tick);
    return () => { vivo = false; window.clearInterval(id); window.removeEventListener("resize", tick); };
  }, [passo]);

  // âncora sumiu por 1,5s (elemento não existe nesta conta) → pula o passo
  useEffect(() => {
    if (tentativas >= 6 && rodando) { setTentativas(0); setIdx((i) => i + 1); }
  }, [tentativas, rodando]);

  // acabaram os passos → concluído
  useEffect(() => { if (rodando && idx >= PASSOS.length) onConcluir(); }, [rodando, idx, onConcluir]);

  const total = PASSOS.length;
  const interativo = Boolean(passo?.espera);
  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // balão: embaixo da âncora se ela está na metade de cima; senão em cima
  const posBalao = useMemo(() => {
    const larg = Math.min(360, vw - 24);
    const left = Math.max(12, Math.min(vw - larg - 12, (rect ? rect.left + rect.width / 2 : vw / 2) - larg / 2));
    if (!rect) return { left, top: vh / 2 - 90, larg, seta: "none" as const };
    const emCima = rect.top + rect.height / 2 > vh / 2;
    return emCima
      ? { left, larg, bottom: vh - rect.top + 14, seta: "baixo" as const }
      : { left, larg, top: rect.top + rect.height + 14, seta: "cima" as const };
  }, [rect, vw, vh]);

  if (!passo) return null;
  const pad = 8;

  // Folha de venda/gorjeta aberta durante um passo interativo: só a tarja no topo.
  if (interativo && folhaAberta) {
    return createPortal(
      <div className="fixed inset-x-0 z-[80] flex justify-center px-4" style={{ top: "max(env(safe-area-inset-top), 10px)", pointerEvents: "none" }}>
        <div className="rounded-full px-4 py-2 text-[12.5px] font-semibold flex items-center gap-2"
          style={{ background: "rgba(23,19,10,.96)", border: "1px solid rgba(245,184,0,.35)", color: "#F5B800" }}>
          <span className="w-2 h-2 rounded-full" style={{ background: "#F5B800", animation: "orbis-tour-pulse 1.2s ease-in-out infinite" }} />
          {passo.dica}
        </div>
        <style>{`@keyframes orbis-tour-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[80]" style={{ pointerEvents: interativo ? "none" : "auto" }} aria-live="polite">
      {/* Recorte: no passo explicativo o box-shadow gigante vira o véu escuro em volta.
          No interativo não há véu — só o anel dourado pulsando no botão real. */}
      {rect && (
        <div className="absolute rounded-[16px]"
          style={{
            top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2,
            boxShadow: interativo ? "0 0 0 3px #F5B800, 0 0 24px 4px rgba(245,184,0,.45)" : "0 0 0 100vmax rgba(0,0,0,.80), 0 0 0 2px rgba(245,184,0,.9)",
            animation: interativo ? "orbis-tour-pulse 1.2s ease-in-out infinite" : undefined,
            transition: "top .25s, left .25s, width .25s, height .25s",
            pointerEvents: "none",
          }} />
      )}
      {!rect && !interativo && <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.80)" }} />}

      {/* Balão */}
      <div className="absolute rounded-[20px] border p-4 text-left"
        style={{
          left: posBalao.left, width: posBalao.larg,
          ...("top" in posBalao ? { top: posBalao.top } : { bottom: (posBalao as { bottom: number }).bottom }),
          background: "linear-gradient(160deg,#17130A 0%,#111 55%)",
          borderColor: "rgba(245,184,0,.35)", boxShadow: "0 24px 70px -24px rgba(245,184,0,.45)",
          pointerEvents: "auto", transition: "top .25s, bottom .25s, left .25s",
        }}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em]" style={{ color: "#F5B800" }}>
            {passo.espera === "inicio" ? "Treino guiado" : `${passo.rotulo} · passo ${Math.min(idx + 1, total)} de ${total}`}
          </p>
          {passo.espera !== "inicio" && (
            <button type="button" onClick={() => setIdx(total)} className="text-[11px] font-semibold" style={{ color: "#7E7869" }}>
              pular tour
            </button>
          )}
        </div>
        <h3 className="font-display text-[17px] font-extrabold leading-tight mt-1" style={{ color: "#F4F1EA" }}>{passo.titulo}</h3>
        <p className="text-[13px] leading-[1.5] mt-1.5" style={{ color: "#B9B3A6" }}>{passo.texto}</p>

        {interativo ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(245,184,0,.10)", border: "1px solid rgba(245,184,0,.25)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#F5B800", animation: "orbis-tour-pulse 1.2s ease-in-out infinite" }} />
            <p className="text-[12.5px] font-semibold" style={{ color: "#F5B800" }}>{passo.dica}</p>
          </div>
        ) : (
          <button type="button" onClick={() => setIdx((i) => i + 1)} className="orbis-cta w-full mt-3" style={{ height: 46 }}>
            {passo.cta ?? "Próximo"}
          </button>
        )}
      </div>

      <style>{`@keyframes orbis-tour-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
    </div>,
    document.body,
  );
}

/* --- Card final: "Treino concluído — agora é de verdade" --- */
export function TreinoConcluido({ onVoltar }: { onVoltar: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center" role="dialog" aria-modal="true" style={{ pointerEvents: "auto" }}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.84)" }} />
      <div className="orbis-victory relative w-full max-w-md mx-6 rounded-[22px] border p-6 text-center"
        style={{ "--win-color": "rgba(245,184,0,.55)", background: "linear-gradient(160deg,#1C1608 0%,#111 60%)", borderColor: "rgba(245,184,0,.4)", boxShadow: "0 24px 70px -24px rgba(245,184,0,.5)" } as React.CSSProperties}>
        <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(180deg,#FFC63A,#F5B800)", boxShadow: "0 4px 0 #B88700" }}>
          <Check size={28} strokeWidth={3.2} color="#1A1200" />
        </div>
        <p className="mt-4 text-[10.5px] font-extrabold uppercase tracking-[.18em]" style={{ color: "#F5B800" }}>Treino concluído</p>
        <h2 className="font-display text-[22px] font-extrabold mt-1.5 leading-[1.3]" style={{ color: "#F4F1EA" }}>
          Você já sabe usar o DEFCON 4.<br /><span style={{ color: "#F5B800" }}>Nada disso foi pro ranking.</span>
        </h2>
        <p className="text-[13px] mt-2.5 leading-[1.5]" style={{ color: "#B9B3A6" }}>
          Quando for de verdade, é o mesmo caminho: <b style={{ color: "#F4F1EA" }}>Foco → Iniciar DEFCON 4</b>. Sem sinal? Funciona igual — sobe sozinho depois.
        </p>
        <button type="button" onClick={onVoltar} className="orbis-cta w-full mt-5">VOLTAR PRO INÍCIO</button>
      </div>
    </div>,
    document.body,
  );
}
