/* ============================================================
   X1 · TÔ NA PISTA + DISPONÍVEIS AGORA + CINTURÃO (mock-x1-desafiar / falta)
   • PistaCard: o interruptor do dia. Ligado, quem te encarar já começa o
     duelo (amistoso), sem esperar aceite.
   • Disponiveis: quem está na pista ou com DEFCON aberto. ENCARAR = 1 toque.
   • CinturaoCard: o campeão da sua cidade, desde quando, defesas, linha do tempo.
   ============================================================ */
import { useState } from "react";
import { Loader2, Crown } from "lucide-react";
import { X1Avatar } from "./X1Avatar";
import { fmt, primeiroNome } from "./x1-lib";
import { chamadaCinturao, type Cinturao, type Disponivel, type Pista } from "./x1-lote5";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const MUTE = "#8a8378";

export function PistaCard({ pista, eu, onTrocar }: { pista: Pista | null; eu: { nome: string; avatar_url: string | null }; onTrocar: (on: boolean) => Promise<void> }) {
  const [mudando, setMudando] = useState(false);
  const ligado = !!pista?.ligado;
  const trocar = async () => { setMudando(true); await onTrocar(!ligado); setMudando(false); };
  return (
    <div className="rounded-[20px] border p-3.5" style={ligado
      ? { background: "linear-gradient(160deg,#0b2016,#0e0e10 70%)", borderColor: "rgba(61,214,140,.45)" }
      : { background: "linear-gradient(160deg,#2a0c11,#0e0e10 70%)", borderColor: "rgba(242,70,90,.35)" }}>
      <div className="flex items-center gap-3">
        <X1Avatar url={eu.avatar_url} nome={eu.nome} size={50} cor={ligado ? OK : "#3a3833"} />
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-black leading-tight">Tô na pista hoje</p>
          <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: "#b3ab9c" }}>Quem te encarar já começa o duelo. Sem esperar aceite.</p>
        </div>
        <button type="button" role="switch" aria-checked={ligado} aria-label="Tô na pista hoje" onClick={trocar} disabled={mudando}
          className="relative w-[58px] h-[32px] rounded-full shrink-0 transition-colors disabled:opacity-60"
          style={{ background: ligado ? OK : "#2a2823" }}>
          {mudando
            ? <Loader2 className="w-4 h-4 animate-spin absolute top-2 left-[21px]" style={{ color: "#fff" }} />
            : <span className="absolute top-[3px] w-[26px] h-[26px] rounded-full bg-white transition-all" style={{ left: ligado ? 29 : 3 }} />}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold" style={ligado
          ? { background: "#0d1f16", border: "1px solid rgba(61,214,140,.4)", color: OK }
          : { background: "#16151a", border: "1px solid #2a2823", color: MUTE }}>
          <i className="w-1.5 h-1.5 rounded-full" style={{ background: ligado ? OK : MUTE }} />
          {ligado ? `disponível · ${pista?.te_veem ?? 0} vendedores te veem` : pista?.no_defcon ? "no DEFCON: já aparece na arena" : "fora da pista"}
        </span>
        {(pista?.na_pista ?? 0) > 0 && <span className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold" style={{ background: "#1a1305", border: "1px solid #3a2f0c", color: GOLD }}>{pista?.na_pista} na pista agora</span>}
      </div>
    </div>
  );
}

export function Disponiveis({ lista, encarando, onEncarar, onVerTodos }: { lista: Disponivel[]; encarando: string | null; onEncarar: (d: Disponivel) => void; onVerTodos: () => void }) {
  if (lista.length === 0) return null;
  return (
    <div className="rounded-[20px] border px-3.5 py-2.5" style={{ background: "#0e0e10", borderColor: "#22201a" }}>
      <div className="flex items-center justify-between py-1">
        <p className="text-[14px] font-black">Disponíveis agora</p>
        <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ background: "#0d1f16", border: "1px solid rgba(61,214,140,.4)", color: OK }}>{lista.length} na arena</span>
      </div>
      {lista.slice(0, 4).map((d) => (
        <div key={d.user_id} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: "1px solid #22201a" }}>
          <X1Avatar url={d.avatar_url} nome={d.nome} size={42} cor={OK} />
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-black truncate">{primeiroNome(d.nome)}{d.patente ? <span style={{ color: MUTE }}> · {d.patente}</span> : null}</p>
            <p className="text-[11px] truncate" style={{ color: MUTE }}>
              {d.posicao ? `#${d.posicao} · ` : ""}{d.vendido_hoje > 0 ? `já vendeu ${fmt(d.vendido_hoje)} hoje` : "ainda não vendeu hoje"}{d.cidade ? ` · ${d.cidade}` : ""}
            </p>
            <p className="text-[10.5px] font-bold" style={{ color: OK }}>● {d.na_pista ? "na pista · começa na hora" : "no DEFCON · começa na hora"}</p>
          </div>
          <button type="button" onClick={() => onEncarar(d)} disabled={!!encarando}
            className="h-10 px-3.5 rounded-[12px] text-[12.5px] font-black shrink-0 inline-flex items-center gap-1.5 disabled:opacity-60" style={{ background: GOLD, color: "#1a1305" }}>
            {encarando === d.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : "ENCARAR"}
          </button>
        </div>
      ))}
      <button type="button" onClick={onVerTodos} className="w-full h-9 text-[12px] font-black" style={{ color: GOLD, borderTop: "1px solid #22201a" }}>
        {lista.length > 4 ? `VER TODOS OS ${lista.length}` : "PROCURAR ALGUÉM PELO NOME"}
      </button>
    </div>
  );
}

const dm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export function CinturaoCard({ c, onDesafiar }: { c: Cinturao | null; onDesafiar: (userId: string | null) => void }) {
  if (!c || !c.cidade) return null;
  const k = c.campeao;
  return (
    <div className="rounded-[20px] border p-3.5" style={{ background: "linear-gradient(160deg,#1f1604,#0e0e10 70%)", borderColor: "rgba(245,184,0,.45)" }}>
      <p className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>
        <Crown className="w-3.5 h-3.5" strokeWidth={2.6} /> CINTURÃO DE {c.cidade.toUpperCase()}
      </p>
      <div className="flex items-center gap-3 mt-2.5">
        {k ? <X1Avatar url={k.avatar_url} nome={k.nome} size={52} cor={GOLD} /> : <span className="w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0" style={{ border: `2px dashed ${GOLD}66` }}><Crown className="w-5 h-5" style={{ color: GOLD }} /></span>}
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-black leading-tight">{k ? (k.sou_eu ? "O cinturão é seu" : `${primeiroNome(k.nome)} é o campeão`) : "Cinturão vago"}</p>
          {k && <p className="text-[11.5px] mt-0.5" style={{ color: "#b3ab9c" }}>campeão há <b className="text-foreground">{k.dias} {k.dias === 1 ? "dia" : "dias"}</b> · {k.defesas} {k.defesas === 1 ? "defesa" : "defesas"} · {k.vitorias}V</p>}
        </div>
        {!k?.sou_eu && (
          <button type="button" onClick={() => onDesafiar(k?.user_id ?? null)} className="h-10 px-3 rounded-[12px] text-[12px] font-black shrink-0" style={{ background: GOLD, color: "#1a1305" }}>
            {k ? "DESAFIAR" : "PEGAR"}
          </button>
        )}
      </div>
      <p className="text-[11.5px] mt-2.5" style={{ color: "#b3ab9c" }}>{chamadaCinturao(c)}</p>
      {c.linha.length > 0 && (
        <div className="mt-2 rounded-[14px] px-3 py-1" style={{ background: "rgba(0,0,0,.3)" }}>
          {c.linha.slice(0, 3).map((h, i) => (
            <p key={i} className="text-[11px] py-1.5 flex gap-2" style={{ borderTop: i === 0 ? "none" : "1px solid #22201a", color: "#b3ab9c" }}>
              <b className="tabular-nums shrink-0" style={{ color: MUTE }}>{dm(h.em)}</b>
              <span className="truncate">{h.tipo === "tomou" ? <><b className="text-foreground">{primeiroNome(h.nome)}</b> tirou de {primeiroNome(h.de_nome)}</> : h.tipo === "defendeu" ? <><b className="text-foreground">{primeiroNome(h.nome)}</b> defendeu contra {primeiroNome(h.de_nome)}</> : <><b className="text-foreground">{primeiroNome(h.nome)}</b> conquistou o cinturão</>}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
