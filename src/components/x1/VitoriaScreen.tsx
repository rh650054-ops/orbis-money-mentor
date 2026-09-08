/* ============================================================
   TELA DE RESULTADO — VITÓRIA / DERROTA / EMPATE (tela cheia, animada).
   Vitória: raios girando, "VITÓRIA" letra por letra, card entra com soco +
   faíscas, faixa "CAMPEÃO DO DUELO" GIRANDO ao redor da foto (pedido do Rick),
   confete, XP enchendo, brilho no card, botão pulsando.
   Derrota: raios vermelhos, card treme e escurece, "REVANCHE" em destaque.
   ============================================================ */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Share2, Swords, X, RotateCcw } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { X1Avatar } from "./X1Avatar";
import { XpBar } from "./FighterCard";
import { fmt, primeiroNome, proximaPatente, type Pessoa, type Recorde } from "./x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";
const HOT = "#ff7a1a";

const CONFETE = ["#F5B800", "#3DD68C", "#fff", "#F2465A", "#F5B800", "#4FD8F5", "#fff", "#F5B800", "#3DD68C", "#F2465A", "#F5B800", "#fff", "#F5B800"];
const FAISCAS = [[-90, -60], [80, -70], [-110, 20], [120, 10], [-40, -110], [50, -100]];

/** Faixa de texto girando em círculo ao redor da foto (SVG textPath). */
function FaixaOrbita({ texto, cor, raio = 78 }: { texto: string; cor: string; raio?: number }) {
  const tam = raio * 2 + 40;
  const c = tam / 2;
  return (
    <svg className="x1-orbit absolute pointer-events-none" width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} style={{ left: "50%", top: "50%", marginLeft: -c, marginTop: -c }} aria-hidden>
      <defs>
        <path id="x1-orb" d={`M ${c},${c} m -${raio},0 a ${raio},${raio} 0 1,1 ${raio * 2},0 a ${raio},${raio} 0 1,1 -${raio * 2},0`} />
      </defs>
      <circle cx={c} cy={c} r={raio} fill="none" stroke={cor} strokeOpacity=".25" strokeWidth="18" />
      <text fontSize="11" fontWeight="900" letterSpacing="3" fill={cor} style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        <textPath href="#x1-orb" startOffset="0">{`${texto} · ${texto} · `}</textPath>
      </text>
    </svg>
  );
}

export function VitoriaScreen({ tipo, eu, ele, recorde, meu, dele, aposta, premio, onFechar, onProximo, onRevanche }: {
  tipo: "vitoria" | "derrota" | "empate"; eu: Pessoa; ele: Pessoa; recorde: Recorde;
  meu: number; dele: number; aposta: number; premio: number;
  onFechar: () => void; onProximo: () => void; onRevanche: () => void;
}) {
  const [xpAnimado, setXpAnimado] = useState(false);
  useEffect(() => {
    try { navigator.vibrate?.(tipo === "vitoria" ? [80, 60, 80, 60, 160] : [200]); } catch { /* sem vibração */ }
    const t = setTimeout(() => setXpAnimado(true), 2200);
    return () => clearTimeout(t);
  }, [tipo]);

  const venci = tipo === "vitoria";
  const cor = venci ? GOLD : tipo === "derrota" ? RED : "#b3ab9c";
  const nome = primeiroNome(ele.nome);
  const titulo = venci ? "VITÓRIA" : tipo === "derrota" ? "DERROTA" : "EMPATE";
  const prox = proximaPatente(recorde.patente);
  const faltam = recorde.pontos_proxima != null ? Math.max(0, recorde.pontos_proxima - recorde.pontos) : 0;
  // barra: mostra o "antes" (−10 pts) e enche até o atual
  const rAntes: Recorde = venci ? { ...recorde, pontos: Math.max(0, recorde.pontos - 10) } : recorde;

  const compartilhar = async () => {
    const texto = venci
      ? `Venci ${nome} no X1 do Orbis: ${fmt(meu)} × ${fmt(dele)}. ${recorde.vitorias} vitórias na arena. Quem é o próximo?`
      : tipo === "derrota" ? `Perdi pro ${nome} no X1 do Orbis por ${fmt(dele - meu)}. Amanhã tem revanche.` : `Empate no X1 do Orbis com ${nome}: ${fmt(meu)} cada.`;
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else { await navigator.clipboard.writeText(texto); toast({ title: "Copiado! Cola no story." }); }
    } catch { /* cancelou */ }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] overflow-y-auto" style={{ background: "#000" }}>
      <div className={`x1-rays ${venci ? "" : "vermelho"}`} />
      <div className="absolute pointer-events-none" style={{ left: "50%", top: "32%", width: 520, height: 520, margin: "-260px 0 0 -260px", background: `radial-gradient(circle,${cor}44 0%,${cor}11 40%,transparent 65%)` }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(120% 90% at 50% 40%,transparent 40%,#000 100%)" }} />
      {venci && CONFETE.map((c, i) => <i key={i} className="x1-confetti" style={{ left: `${5 + i * 7.3}%`, background: c, animationDelay: `${0.9 + (i % 5) * 0.28}s` }} />)}
      {venci && FAISCAS.map(([dx, dy], i) => <i key={i} className="x1-spark" style={{ left: "50%", top: "42%", animationDelay: `${1.5 + i * 0.02}s`, "--dx": `${dx}px`, "--dy": `${dy}px` } as React.CSSProperties} />)}

      <div className="relative z-[2] max-w-md mx-auto px-5 pt-7 pb-8 flex flex-col items-center" style={{ paddingTop: "calc(env(safe-area-inset-top) + 24px)" }}>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute right-3 top-3 w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "rgba(255,255,255,.55)", top: "calc(env(safe-area-inset-top) + 8px)" }}><X className="w-5 h-5" /></button>
        <p className="x1-up text-[10px] font-black tracking-[.22em]" style={{ color: cor }}>X1 FECHADO · 23:59</p>
        <p className="flex mt-1.5 text-[56px] font-black italic tracking-[-.04em] leading-none" aria-label={titulo}>
          {titulo.split("").map((l, i) => (
            <span key={i} className="x1-letter" style={{ "--i": i, background: venci ? "linear-gradient(180deg,#FFE58A 0%,#F5B800 55%,#B88700 100%)" : tipo === "derrota" ? "linear-gradient(180deg,#ff8a97 0%,#F2465A 55%,#8a1020 100%)" : "linear-gradient(180deg,#e9e4d8,#8a8378)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", filter: `drop-shadow(0 4px 0 ${venci ? "#6b4d00" : "#3a0a10"}) drop-shadow(0 0 22px ${cor}88)` } as React.CSSProperties}>{l}</span>
          ))}
        </p>
        <p className="x1-up text-[13.5px] mt-2" style={{ "--i": 12, color: "#e9e4d8" } as React.CSSProperties}>
          {venci ? <>Você venceu {nome} por <b style={{ color: OK }}>{fmt(meu - dele)}</b></> : tipo === "derrota" ? <>{nome} levou por <b style={{ color: "#ff7d8c" }}>{fmt(dele - meu)}</b></> : <>Empate com {nome} · {fmt(meu)} cada</>}
        </p>

        {/* CARD DO CAMPEÃO */}
        <div className={`w-full mt-5 relative rounded-[28px] px-4 pt-7 pb-4 text-center overflow-visible ${venci ? "x1-slam" : "x1-lose"}`}
          style={{ animationDelay: venci ? "1.4s" : ".8s", background: venci ? "linear-gradient(180deg,#1f1706 0%,#0b0b0d 65%)" : "linear-gradient(180deg,#1a0b0f 0%,#0b0b0d 65%)", border: `2px solid ${cor}`, boxShadow: `0 0 0 6px ${cor}22, 0 40px 80px -30px ${cor}aa` }}>
          <div className="absolute inset-0 rounded-[28px] overflow-hidden pointer-events-none">{venci && <span className="x1-shine" />}</div>
          <div className="relative mx-auto" style={{ width: 118, height: 118 }}>
            {venci && <FaixaOrbita texto="CAMPEÃO DO DUELO" cor={GOLD} />}
            <X1Avatar url={venci ? eu.avatar_url : ele.avatar_url} nome={venci ? eu.nome : ele.nome} size={118} cor={cor} style={{ borderWidth: 4, boxShadow: `0 0 0 8px ${cor}22, 0 0 50px ${cor}77`, position: "relative", zIndex: 2 }} />
          </div>
          <p className="text-[24px] font-black tracking-[-.03em] mt-4 leading-none">{venci ? primeiroNome(eu.nome) : nome}</p>
          <span className="inline-flex items-center gap-1.5 mt-2 rounded-full px-3 py-1 text-[10.5px] font-black tracking-[.14em]" style={{ background: `${cor}1a`, border: `1px solid ${cor}`, color: cor }}>
            {venci ? `${recorde.patente} · ${recorde.vitorias} ${recorde.vitorias === 1 ? "VITÓRIA" : "VITÓRIAS"}` : "LEVOU ESSA"}
          </span>
          <div className="flex items-center justify-center gap-3 mt-3.5 px-3 py-2.5 rounded-[16px]" style={{ background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.08)" }}>
            <b className="text-[22px] font-black tabular-nums" style={{ color: venci ? OK : "#8a8378" }}>{fmt(meu)}</b>
            <span className="text-[14px] font-black italic" style={{ color: GOLD }}>×</span>
            <span className="flex items-center gap-2"><b className="text-[22px] font-black tabular-nums" style={{ color: tipo === "derrota" ? "#ff7d8c" : "#8a8378" }}>{fmt(dele)}</b><X1Avatar url={venci ? ele.avatar_url : eu.avatar_url} nome={venci ? ele.nome : eu.nome} size={30} cor="#5a4a4e" style={{ filter: "grayscale(1)" }} /></span>
          </div>
          <div className="relative text-left">
            <XpBar r={xpAnimado ? recorde : rAntes} animar />
            {venci && xpAnimado && <span className="x1-float absolute right-0 -top-1 text-[11px] font-black" style={{ color: OK }}>+10 XP · VITÓRIA</span>}
          </div>
          <p className="text-[11.5px] mt-2" style={{ color: "#b3ab9c" }}>
            {prox ? <>Faltam <b style={{ color: GOLD }}>{faltam} XP</b> pra virar <b style={{ color: "#4FD8F5" }}>{prox}</b>{prox === "BRIGÃO" ? " e liberar aposta" : ""}.</> : <>Você é <b style={{ color: "#B47CFF" }}>LENDA</b> da arena.</>}
          </p>
        </div>

        {/* TILES */}
        <div className="flex gap-2 w-full mt-3.5">
          {[
            venci && premio > 0 ? { k: "CARTEIRA", v: `+ ${fmt(premio)}`, s: `aposta ${Math.round(aposta)} · voltou ${Math.round(premio)}`, c: OK }
              : tipo === "derrota" && aposta > 0 ? { k: "CARTEIRA", v: `− ${fmt(aposta)}`, s: "foi pro vencedor", c: "#ff7d8c" }
              : { k: "MODO", v: aposta > 0 ? "devolvido" : "HONRA", s: aposta > 0 ? "empate devolve" : "amistoso vale XP", c: GOLD },
            { k: "SEQUÊNCIA", v: String(recorde.sequencia), s: recorde.sequencia >= 2 ? "em chamas" : venci ? "começou agora" : "zerou · volta amanhã", c: HOT },
            { k: "RECORDE", v: `${recorde.vitorias}V ${recorde.derrotas}D`, s: `${recorde.duelos} ${recorde.duelos === 1 ? "luta" : "lutas"}`, c: GOLD },
          ].map((t, i) => (
            <div key={t.k} className="x1-up flex-1 rounded-[16px] px-1.5 py-2.5 text-center" style={{ "--i": 30 + i * 2, background: "#0e0e10", border: "1px solid #22201a" } as React.CSSProperties}>
              <p className="text-[9px] font-black tracking-[.14em]" style={{ color: t.c }}>{t.k}</p>
              <p className="text-[17px] font-black tabular-nums mt-0.5" style={{ color: t.c }}>{t.v}</p>
              <p className="text-[9.5px] mt-0.5" style={{ color: "#8a8378" }}>{t.s}</p>
            </div>
          ))}
        </div>

        <button type="button" onClick={venci ? onProximo : onRevanche} className="x1-btn ouro x1-pulse x1-up w-full mt-4" style={{ "--i": 40 } as React.CSSProperties}>
          {venci ? <><Swords className="w-5 h-5" strokeWidth={2.6} /> PRÓXIMO OPONENTE</> : <><RotateCcw className="w-5 h-5" strokeWidth={2.6} /> REVANCHE AMANHÃ</>}
        </button>
        <div className="flex gap-2 w-full mt-2 x1-up" style={{ "--i": 43 } as React.CSSProperties}>
          <button type="button" onClick={compartilhar} className="x1-btn fantasma flex-1"><Share2 className="w-4 h-4" strokeWidth={2.6} /> Compartilhar</button>
          <button type="button" onClick={venci ? onRevanche : onProximo} className="x1-btn fantasma flex-1">{venci ? <><RotateCcw className="w-4 h-4" strokeWidth={2.6} /> Revanche</> : <><Swords className="w-4 h-4" strokeWidth={2.6} /> Outro oponente</>}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
