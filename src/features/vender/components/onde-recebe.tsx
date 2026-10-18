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

export function OndeRecebe({ bancos, ligando, onLigar, onAbrir, onAutorizar }: Props) {
  return (
    <Secao titulo="ONDE VOCÊ RECEBE" id="sec-bancos"
      acao={<span className="text-[11px] font-bold" style={{ color: COR.apagado }}>{bancos.length} {bancos.length === 1 ? "conta conectada" : "contas conectadas"}</span>}>
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
                <p className="text-[11.5px] truncate" style={{ color: sem ? COR.ouro : COR.apagado }}>
                  {papelTexto(b.papel)} · {st.detalhe}
                </p>
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
            <span className="block text-[11.5px]" style={{ color: COR.apagado }}>quem liga todos comprova tudo que vende</span>
          </span>
        </button>
      </div>
    </Secao>
  );
}
