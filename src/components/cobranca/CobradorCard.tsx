/* ============================================================
   COBRADOR DE CALOTE — o card do fechamento do DEFCON.
   Mostra quanto faltou cair e a lista dos clientes que o vendedor
   registrou hoje (nome + telefone). Um toque em COBRAR leva pra tela
   que gera o Pix na carteira dele e abre o WhatsApp com a mensagem.
   Só aparece quando faltou dinheiro OU quando já existe cobrança viva.
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Check, ChevronRight, HandCoins } from "lucide-react";
import {
  carregarClientesDoDia, carregarResumo, fmt, horaBR, iniciais,
  telefoneBonito, telefoneServe, type ClienteDoDia, type ResumoCobranca,
} from "./cobranca-lib";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const RED = "#F2465A";

export function CobradorCard({ userId, faltouCair }: { userId?: string; faltouCair: number }) {
  const navigate = useNavigate();
  const [lista, setLista] = useState<ClienteDoDia[]>([]);
  const [resumo, setResumo] = useState<ResumoCobranca | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!userId) return;
    const [cs, rs] = await Promise.all([carregarClientesDoDia(), carregarResumo()]);
    setLista(cs);
    setResumo(rs);
    setCarregando(false);
  }, [userId]);

  useEffect(() => { void carregar().catch(() => setCarregando(false)); }, [carregar]);

  if (!userId || carregando) return null;

  const emAberto = lista.filter((c) => c.cobranca_status !== "paga");
  const pagas = lista.filter((c) => c.cobranca_status === "paga");
  // nada faltando e ninguém cobrado: não polui o fechamento
  if (faltouCair < 0.005 && lista.length === 0) return null;
  if (faltouCair < 0.005 && emAberto.length === 0 && pagas.length === 0) return null;

  return (
    <>
    <p className="orbis-section mt-6 px-1">Cobrar quem ficou devendo</p>
    <div className="rounded-[22px] border mt-3 overflow-hidden"
      style={{ borderColor: faltouCair > 0.005 ? "rgba(242,70,90,.28)" : "rgba(61,214,140,.28)", background: faltouCair > 0.005 ? "radial-gradient(120% 85% at 50% -10%,#3a0c14 0%,#1a0508 42%,#0b0b0d 80%)" : "linear-gradient(180deg,#0b1a14,#0a0a0c)" }}>

      <div className="px-4 pt-4 pb-3">
        <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: faltouCair > 0.005 ? "#ff8a97" : OK }}>
          {faltouCair > 0.005 ? "FALTOU CAIR HOJE" : "TUDO RECEBIDO HOJE"}
        </p>
        <p className="orbis-num text-[26px] font-black tracking-[-.035em] leading-none mt-1.5">
          {fmt(faltouCair)}
        </p>
        <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>
          {faltouCair > 0.005
            ? "O Orbis gera o Pix de quem ficou devendo e abre seu WhatsApp com a mensagem pronta. Quando pagar, isso aqui cai sozinho."
            : "Nada em aberto. Se alguém ficar devendo amanhã, é daqui que você cobra."}
        </p>
        {resumo && resumo.pagas_mes > 0 && (
          <p className="text-[11.5px] font-bold mt-2 inline-flex items-center gap-1.5" style={{ color: OK }}>
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
            {fmt(resumo.recuperado_mes)} recuperados esse mês
          </p>
        )}
      </div>

      {lista.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[9.5px] font-black tracking-[.18em] pb-1" style={{ color: "var(--orbis-fg-3)" }}>
            CLIENTES DE HOJE
          </p>
          {lista.slice(0, 6).map((c) => {
            const pago = c.cobranca_status === "paga";
            const esperando = c.cobranca_status === "pendente";
            const podeZap = telefoneServe(c.telefone);
            return (
              <button
                key={c.client_id}
                type="button"
                onClick={() => navigate(`/cobrar?cliente=${c.client_id}`)}
                className="w-full text-left flex items-center gap-3 py-2.5 active:opacity-70"
                style={{ borderTop: "1px solid var(--orbis-line)" }}
              >
                <span className="w-[38px] h-[38px] rounded-[13px] shrink-0 flex items-center justify-center text-[12.5px] font-black"
                  style={pago
                    ? { background: "rgba(61,214,140,.1)", border: `1px solid ${OK}59`, color: OK }
                    : { background: "linear-gradient(180deg,#3a1116,#22090d)", border: `1px solid ${RED}66`, color: "#ff8a97" }}>
                  {iniciais(c.nome)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-extrabold truncate">{c.nome || "Cliente"}</span>
                  <span className="block text-[11.5px] truncate" style={{ color: "var(--orbis-fg-3)" }}>
                    {c.hora ? `levou ${horaBR(c.hora)}` : "hoje"}
                    {podeZap ? ` · ${telefoneBonito(c.telefone)}` : " · sem telefone"}
                  </span>
                </span>
                {pago ? (
                  <span className="shrink-0 h-[34px] px-3 rounded-[11px] inline-flex items-center gap-1.5 text-[11px] font-black"
                    style={{ background: "rgba(61,214,140,.08)", border: `1px solid ${OK}59`, color: OK }}>
                    <Check className="w-3.5 h-3.5" strokeWidth={3} /> PAGOU
                  </span>
                ) : esperando ? (
                  <span className="shrink-0 h-[34px] px-3 rounded-[11px] inline-flex items-center gap-1.5 text-[11px] font-black"
                    style={{ background: "rgba(245,184,0,.08)", border: `1px solid ${GOLD}52`, color: GOLD }}>
                    <Loader2 className="w-3.5 h-3.5" /> ESPERANDO
                  </span>
                ) : (
                  <span className="shrink-0 h-[34px] px-3 rounded-[11px] inline-flex items-center gap-1 text-[11px] font-black"
                    style={{ background: "linear-gradient(180deg,#FFD152,#F5B800 60%,#E0A500)", color: "#1a1305", boxShadow: "0 1px 0 rgba(255,255,255,.35) inset, 0 3px 0 #A87E00" }}>
                    COBRAR <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="px-4 pb-4">
        <button type="button" onClick={() => navigate("/cobrar")} className="orbis-cta w-full">
          <HandCoins className="w-4 h-4" strokeWidth={2.4} />
          {lista.length > 0 ? "COBRAR OUTRA PESSOA" : "CRIAR UMA COBRANÇA"}
        </button>
      </div>
    </div>
    </>
  );
}
