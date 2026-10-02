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

export function CobradorCard({ userId, faltouCair, pixAindaPodeCair = false }: {
  userId?: string;
  faltouCair: number;
  /** banco ligado: a diferença pode ser Pix que o banco ainda não mostrou (lê de hora em hora até 23:59) */
  pixAindaPodeCair?: boolean;
}) {
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

  const falta = faltouCair > 0.005;
  // Com banco ligado, "faltou" pode ser só Pix atrasado: âmbar, não vermelho.
  const tom = !falta ? OK : pixAindaPodeCair ? GOLD : "#ff8a97";
  const titulo = !falta ? "TUDO RECEBIDO HOJE" : pixAindaPodeCair ? "AINDA NÃO CAIU" : "FALTOU CAIR HOJE";
  const texto = !falta
    ? "Nada em aberto. Se alguém ficar devendo amanhã, é daqui que você cobra."
    : pixAindaPodeCair
      ? "O banco ainda não mostrou esse valor. Pix atrasado entra sozinho até 23:59. Se alguém ficou devendo, cobra por aqui."
      : "Alguém ficou devendo? A Vant gera o Pix e abre seu WhatsApp com a mensagem pronta.";

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${tom}47`, background: "linear-gradient(180deg,#121214,#0b0b0d)" }}>

      <div className="px-4 pt-3.5 pb-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black tracking-[.15em]" style={{ color: tom }}>{titulo}</p>
          <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>{texto}</p>
          {resumo && resumo.pagas_mes > 0 && (
            <p className="text-[11.5px] font-bold mt-2 inline-flex items-center gap-1.5" style={{ color: OK }}>
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
              {fmt(resumo.recuperado_mes)} recuperados esse mês
            </p>
          )}
        </div>
        {falta && (
          <p className="orbis-num text-[20px] font-black tracking-[-.03em] leading-none shrink-0 pt-0.5" style={{ color: tom }}>
            {fmt(faltouCair)}
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
        <button type="button" onClick={() => navigate("/cobrar")}
          className="w-full h-11 rounded-[13px] inline-flex items-center justify-center gap-2 text-[12.5px] font-extrabold active:opacity-70"
          style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
          <HandCoins className="w-4 h-4" strokeWidth={2.4} />
          {lista.length > 0 ? "COBRAR OUTRA PESSOA" : "COBRAR ALGUÉM"}
        </button>
      </div>
    </div>
  );
}
