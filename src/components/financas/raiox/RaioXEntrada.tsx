/* Entrada do Raio-X do extrato nas Finanças (fica logo abaixo de "Contas a pagar").
   Mostra quais bancos já mandaram o mês atual e leva pra tela do raio-x. */
import { useNavigate } from "react-router-dom";
import { useRaioXMeses } from "@/hooks/useRaioXExtrato";
import { mesAtualIso, mesNome } from "./raiox-utils";

export default function RaioXEntrada({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate();
  const { meses } = useRaioXMeses(userId);
  const atual = mesAtualIso();
  const doMes = meses.find((m) => m.mes === atual);
  const ultimo = meses[0];
  const bancos = (doMes?.bancos ?? []).filter((b) => b && b !== "?");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="orbis-section">Raio-X do extrato</p>
        <span className="text-[11px] font-extrabold uppercase" style={{ color: "#FFC800", letterSpacing: ".12em" }}>novo</span>
      </div>
      <section className="rounded-2xl p-4 relative overflow-hidden" style={{ background: "linear-gradient(160deg,#171307,#0d0d0c)", border: "1px solid rgba(255,200,0,.35)" }}>
        <span className="absolute rounded-full pointer-events-none" style={{ right: -30, top: -30, width: 140, height: 140, background: "radial-gradient(circle,rgba(255,200,0,.22),transparent 65%)" }} />
        <h3 className="text-[16px] font-extrabold tracking-tight text-foreground">Pra onde tá indo seu dinheiro?</h3>
        <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: "#b9b3a6" }}>
          Manda o extrato dos bancos que você usa. A Vant lê, separa por tipo (iFood, Uber, mercado, Pix pra gente…) e mostra o que tá levando mais.
        </p>
        {(bancos.length > 0 || doMes) && (
          <div className="flex gap-1.5 flex-wrap mt-2.5">
            {bancos.map((b) => (
              <span key={b} className="text-[11px] font-bold rounded-full px-2.5 py-1" style={{ color: "#FFC800", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,200,0,.4)" }}>{b} · {mesNome(atual, true)} ✓</span>
            ))}
            <button type="button" onClick={() => navigate(`/financas/extrato?mes=${atual}&v=enviar`)} className="text-[11px] font-bold rounded-full px-2.5 py-1" style={{ color: "#b9b3a6", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>+ enviar outro</button>
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate(doMes ? `/financas/extrato?mes=${atual}` : ultimo ? `/financas/extrato?mes=${ultimo.mes}` : "/financas/extrato?v=enviar")}
          className="mt-3 w-full h-11 rounded-xl text-[14px] font-extrabold"
          style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 12px 30px -12px rgba(255,200,0,.8)" }}
        >
          {doMes ? `Ver o raio-X de ${mesNome(atual)}` : ultimo ? `Ver o raio-X de ${mesNome(ultimo.mes)}` : "Mandar meu extrato"}
        </button>
      </section>
    </div>
  );
}
