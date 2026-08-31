/* ============================================================
   COBRANÇA DO CORRE — o Orbis cobrando o compromisso de horário.
   No onboarding o usuário PROMETEU que horas começa a vender
   (hora_inicio do plano). Este card aparece no dashboard quando:
     - já passou da hora que ele prometeu (com 30min de tolerância),
     - ele ainda não registrou NENHUMA venda hoje,
     - e ainda não foi cobrado hoje (cobra no máximo 1x por dia).
   "Hoje não vou trabalhar" silencia só o dia — amanhã cobra de novo.

   Por que um CARD e não notificação push: push em PWA exige
   service worker + servidor de push (projeto próprio — fica pra
   frente). O card pega o cara na hora que ele abre o app — que é
   quando dá pra agir. Componente de APRESENTAÇÃO + regra própria;
   o Index só passa vendidoHoje e o onComecar.
   ============================================================ */
import { useEffect, useState } from "react";
import { AlarmClock } from "lucide-react";
import { carregarPlano, type PlanoCalculado } from "@/shared/onboarding/plano";

const TOLERANCIA_MIN = 30; // ninguém gosta de cobrador que chega em ponto

const chaveHoje = (userId: string) => {
  const d = new Date();
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `orbis_cobranca_ok_${userId}_${dia}`;
};

export default function CobrancaDoCorre({ userId, vendidoHoje, onComecar }: {
  userId?: string;
  vendidoHoje: number;   // soma de vendas de hoje — > 0 significa que ele já está na rua
  onComecar: () => void; // abre o Modo Foco
}) {
  const [plano, setPlano] = useState<PlanoCalculado | null>(null);
  const [silenciado, setSilenciado] = useState(false);

  useEffect(() => {
    if (!userId) return;
    try { setSilenciado(localStorage.getItem(chaveHoje(userId)) === "1"); } catch { /* nada */ }
    void carregarPlano(userId).then(setPlano);
  }, [userId]);

  // sem hora marcada = sem cobrança (ele escolhe se quer ser cobrado)
  if (!userId || !plano || plano.horaInicio == null || silenciado || vendidoHoje > 0) return null;

  const agora = new Date();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const minutosPrometidos = plano.horaInicio * 60 + TOLERANCIA_MIN;
  if (minutosAgora < minutosPrometidos) return null;
  // depois das 21h não faz sentido cobrar começo de dia — deixa quieto
  if (agora.getHours() >= 21) return null;

  const atrasoMin = minutosAgora - plano.horaInicio * 60;
  const atraso = atrasoMin >= 60 ? `${Math.floor(atrasoMin / 60)}h${atrasoMin % 60 > 0 ? String(atrasoMin % 60).padStart(2, "0") : ""}` : `${atrasoMin}min`;

  const silenciarHoje = () => {
    try { localStorage.setItem(chaveHoje(userId), "1"); } catch { /* nada */ }
    setSilenciado(true);
  };

  return (
    <div className="orbis-card-in rounded-[18px] border p-4"
      style={{ background: "linear-gradient(160deg,#1A0E08 0%,var(--orbis-surface) 60%)", borderColor: "rgba(255,92,92,.35)" }}>
      <div className="flex items-center gap-3">
        <span className="flex-none w-10 h-10 rounded-[13px] flex items-center justify-center"
          style={{ background: "rgba(255,92,92,.14)", border: "1px solid rgba(255,92,92,.4)", color: "var(--orbis-calote, #FF5C5C)" }}>
          <AlarmClock size={20} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 text-left">
          <p className="font-display text-[15px] font-extrabold leading-tight">
            Você marcou de começar às {plano.horaInicio}h.
          </p>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>
            Já passou {atraso} e o placar tá zerado. Combinado é combinado.
          </p>
        </div>
      </div>
      <button type="button" onClick={onComecar} className="orbis-cta w-full mt-3" style={{ height: 46 }}>
        COMEÇAR AGORA
      </button>
      <button type="button" onClick={silenciarHoje}
        className="w-full mt-2 text-[12px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>
        hoje não vou trabalhar
      </button>
    </div>
  );
}
