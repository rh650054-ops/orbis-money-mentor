/* Level 3 — "Onde você recebe": each bank with its role, last check and status. */
import { Landmark, Plus, Loader2 } from "lucide-react";
import type { BancoLigado } from "@/components/conectar/pluggy";
import { COR, Secao } from "@/shared/components/vant-ui";
import { LinhaToque, Pilula } from "@/shared/components/vant-status";
import { papelTexto, statusDoBanco } from "../lib/bancos";

function Logo({ b }: { b: BancoLigado }) {
  return b.institution_logo
    ? <img src={b.institution_logo} alt="" className="w-10 h-10 rounded-[12px] shrink-0 object-contain p-1" style={{ background: "#fff" }} />
    : <span className="w-10 h-10 rounded-[12px] shrink-0 grid place-items-center" style={{ background: "#16151a", border: "1px solid #2a2823" }}><Landmark className="w-4 h-4" style={{ color: COR.apagado }} /></span>;
}

interface Props { bancos: BancoLigado[]; ligando: boolean; onLigar: () => void; onAbrir: () => void; onAutorizar: (b: BancoLigado) => void }

const classificar = (n: number) => (n === 1 ? "1 conta sem classificação" : `${n} contas sem classificação`);

export function OndeRecebe({ bancos, ligando, onLigar, onAbrir, onAutorizar }: Props) {
  const faltam = bancos.filter((b) => !b.papel).length;
  return (
    <Secao titulo="ONDE VOCÊ RECEBE" id="sec-bancos"
      acao={<button type="button" onClick={onAbrir} className="text-[12px] font-extrabold active:opacity-70" style={{ color: COR.ouro }}>Gerenciar</button>}>
      {faltam > 0 && (
        <button type="button" onClick={onAbrir} className="w-full mb-2 rounded-xl px-3 py-2.5 flex items-center justify-between text-[12.5px] font-extrabold active:scale-[0.98] transition-transform"
          style={{ background: "rgba(245,184,0,.08)", border: "1px solid rgba(245,184,0,.35)", color: COR.ouro }}>
          {classificar(faltam)} <span>Classificar →</span>
        </button>
      )}
      <div className="flex flex-col divide-y divide-[#1b1a17] -my-1">
        {bancos.map((b) => {
          const st = statusDoBanco(b.status, b.last_synced_at);
          const sem = !b.papel;
          return st.autorizar ? (
            <div key={b.id} className="flex items-center gap-3 py-3">
              <Logo b={b} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black truncate">{b.institution_name || "Banco"}</p>
                <p className="text-[11.5px] truncate" style={{ color: COR.coral }}>{st.detalhe}</p>
              </div>
              <button type="button" onClick={() => onAutorizar(b)} disabled={ligando}
                className="shrink-0 h-8 px-3 rounded-[10px] text-[11.5px] font-black transition-transform duration-100 active:scale-[0.97]"
                style={{ background: COR.ouro, color: "#1A1200" }}>Autorizar</button>
            </div>
          ) : (
            <LinhaToque key={b.id} onClick={onAbrir}>
              <Logo b={b} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black truncate">{b.institution_name || "Banco"}</p>
                <p className="text-[11.5px] truncate" style={{ color: sem ? COR.ouro : COR.apagado }}>{papelTexto(b.papel)}</p>
              </div>
              <Pilula tom={st.tom}>{st.rotulo}</Pilula>
            </LinhaToque>
          );
        })}
        <button type="button" onClick={onLigar} disabled={ligando}
          className="flex items-center gap-3 py-3 text-left transition-transform duration-100 active:scale-[0.98]">
          <span className="w-10 h-10 rounded-[12px] shrink-0 grid place-items-center" style={{ border: "1.5px dashed #3a3832" }}>
            {ligando ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: COR.ouro }} /> : <Plus className="w-4 h-4" style={{ color: COR.ouro }} strokeWidth={2.6} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-black">Ligar outro banco</span>
          </span>
        </button>
      </div>
    </Secao>
  );
}
