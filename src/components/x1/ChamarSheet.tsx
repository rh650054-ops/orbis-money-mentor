/* ============================================================
   CHAMAR PRA X1 EM 2 TOQUES — sheet que sobe do rodapé.
   Direto (contra alguém) ou CHAMADA GERAL (aberta pra quem topar).
     • QUANDO: hoje / amanhã
     • VALENDO: Honra (amistoso, sempre liberado) · R$ 10 / 20 / 50 (pela patente)
   A regra vale no banco (x1_criar): patente, saldo, 1 chamada por vez.
   ============================================================ */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { Swords, Loader2 } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { X1Avatar } from "./X1Avatar";
import { amanhaBR, carregarPessoa, carregarRecorde, criarDuelo, fmt, primeiroNome, type Pessoa, type Recorde, RECORDE_VAZIO } from "./x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const APOSTAS = [0, 10, 20, 50];

export interface ChamarAlvo { user_id: string; nome: string; avatar_url: string | null }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null = chamada geral */
  alvo: ChamarAlvo | null;
  eu: Pessoa;
  recorde: Recorde;
  quandoInicial?: "hoje" | "amanha";
  onCriado?: () => void;
}

function Opcao({ on, onClick, cor = GOLD, children }: { on: boolean; onClick: () => void; cor?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="flex-1 h-[52px] rounded-[14px] flex flex-col items-center justify-center font-black text-[13px] active:scale-[0.97] transition-transform"
      style={{ background: on ? `${cor}1a` : "#16151a", border: `1px solid ${on ? cor : "#2a2823"}`, color: on ? cor : "#e9e4d8" }}>
      {children}
    </button>
  );
}

export function ChamarSheet({ open, onOpenChange, alvo, eu, recorde, quandoInicial = "hoje", onCriado }: Props) {
  const [quando, setQuando] = useState<"hoje" | "amanha">(quandoInicial);
  const [aposta, setAposta] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [recAlvo, setRecAlvo] = useState<Recorde>(RECORDE_VAZIO);
  const [alvoFull, setAlvoFull] = useState<ChamarAlvo | null>(alvo);

  useEffect(() => { if (open) { setQuando(quandoInicial); setAposta(0); } }, [open, quandoInicial]);
  useEffect(() => {
    setAlvoFull(alvo);
    if (!alvo) { setRecAlvo(RECORDE_VAZIO); return; }
    let vivo = true;
    carregarRecorde(alvo.user_id).then((r) => { if (vivo) setRecAlvo(r); });
    if (!alvo.nome || alvo.nome === "Vendedor") carregarPessoa(alvo.user_id).then((p) => { if (vivo) setAlvoFull({ ...p }); });
    return () => { vivo = false; };
  }, [alvo]);

  const geral = !alvo;
  const nome = primeiroNome(alvoFull?.nome);
  const limite = recorde.aposta_max;

  const enviar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      await criarDuelo({ oponente: geral ? null : alvo!.user_id, data: quando === "hoje" ? getBrazilDate() : amanhaBR(), aposta, tipo: geral ? "aberto" : "direto" });
      toast({ title: geral ? "Chamada geral aberta!" : `${nome} recebeu seu desafio`, description: geral ? "Quem topar primeiro entra. Expira sozinha em 24h." : "Se ele não responder em 24h, cancela sozinho." });
      onOpenChange(false);
      onCriado?.();
    } catch (e) {
      toast({ title: "Não rolou", description: e instanceof Error ? e.message : "tenta de novo", variant: "destructive" });
    } finally { setEnviando(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[24px] border-t p-0 max-h-[92vh] overflow-y-auto [&>button]:hidden" style={{ background: "#0e0e10", borderColor: "#2a2416" }}>
        <SheetTitle className="sr-only">{geral ? "Abrir chamada geral" : `Chamar ${nome} pra X1`}</SheetTitle>
        <div className="px-[18px] pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
          <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "#2c2a24" }} />

          {/* VOCÊ vs ELE — fotos reais */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <X1Avatar url={eu.avatar_url} nome={eu.nome} size={60} cor={GOLD} />
              <p className="text-[11px] font-black mt-1.5" style={{ color: GOLD }}>VOCÊ · {recorde.vitorias}V</p>
            </div>
            <span className="text-[22px] font-black italic" style={{ color: GOLD, textShadow: `0 0 14px ${GOLD}88` }}>VS</span>
            <div className="text-center">
              {geral ? (
                <span className="inline-flex items-center justify-center rounded-full" style={{ width: 60, height: 60, border: `2px dashed ${RED}`, background: `${RED}14` }}>
                  <Swords className="w-6 h-6" style={{ color: "#ff7d8c" }} strokeWidth={2.4} />
                </span>
              ) : (
                <X1Avatar url={alvoFull?.avatar_url} nome={alvoFull?.nome} size={60} cor={RED} />
              )}
              <p className="text-[11px] font-black mt-1.5" style={{ color: "#ff7d8c" }}>{geral ? "QUEM TOPAR" : `${nome.toUpperCase()} · ${recAlvo.vitorias}V`}</p>
            </div>
          </div>
          <p className="text-[11.5px] text-center mt-2" style={{ color: "#8a8378" }}>
            {geral ? "Qualquer vendedor pode topar. O primeiro que aceitar entra." : "Quem fatura mais no dia, pelo DEFCON. Fecha às 23:59 sozinho."}
          </p>

          <p className="text-[10px] font-black tracking-[.16em] mt-4" style={{ color: "#8a8378" }}>QUANDO</p>
          <div className="flex gap-2 mt-1.5">
            <Opcao on={quando === "hoje"} onClick={() => setQuando("hoje")}>Hoje</Opcao>
            <Opcao on={quando === "amanha"} onClick={() => setQuando("amanha")}>Amanhã</Opcao>
          </div>

          <p className="text-[10px] font-black tracking-[.16em] mt-3.5" style={{ color: "#8a8378" }}>VALENDO</p>
          <div className="flex gap-2 mt-1.5">
            {APOSTAS.map((v) => {
              const trava = v > limite;
              return (
                <button key={v} type="button" disabled={trava} onClick={() => setAposta(v)}
                  className="flex-1 h-[52px] rounded-[14px] flex flex-col items-center justify-center font-black text-[13px] active:scale-[0.97] transition-transform disabled:opacity-40"
                  style={{ background: aposta === v ? (v === 0 ? "#1a1305" : "#2a0c11") : "#16151a", border: `1px solid ${aposta === v ? (v === 0 ? GOLD : RED) : "#2a2823"}`, color: aposta === v ? (v === 0 ? GOLD : "#ff7d8c") : "#e9e4d8" }}>
                  {v === 0 ? "Honra" : `R$ ${v}`}
                  <small className="text-[9px] font-bold tracking-[.06em] mt-0.5" style={{ color: aposta === v ? "inherit" : "#8a8378" }}>{v === 0 ? "AMISTOSO" : trava ? "TRAVADO" : `POTE ${v * 2}`}</small>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] mt-2 leading-snug" style={{ color: "#8a8378" }}>
            {limite <= 0
              ? <>Dinheiro libera a partir de <b style={{ color: "#ff7a1a" }}>BRIGÃO</b> (5 vitórias). Amistoso vale patente e recorde igual.</>
              : <>Aposta sai da carteira só quando {geral ? "alguém" : "ele"} aceitar. Empate devolve. Vencedor leva o pote menos 10%.</>}
          </p>

          <button type="button" onClick={enviar} disabled={enviando} className="orbis-cta w-full mt-4 disabled:opacity-60">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" strokeWidth={2.6} />}
            {geral ? "ABRIR CHAMADA GERAL" : `CHAMAR ${nome.toUpperCase()}`}
          </button>
          <p className="text-[11px] text-center mt-2" style={{ color: "#8a8378" }}>
            {geral ? "Fica visível na arena · expira em 24h se ninguém topar" : "Ele vê agora na arena · se não responder em 24h, cancela sozinho"}
            {aposta > 0 ? ` · aposta ${fmt(aposta)} cada` : ""}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
