import { useQuery } from "@tanstack/react-query";
import { COR } from "@/shared/components/vant-ui";
import { quick, type EstadoQuick } from "../api/ponte";

const hora = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** What the widget channel looks like right now, in words the seller understands. Pure function so
    every case is tested. */
export function lerDiagnostico(e: EstadoQuick | null): { ok: boolean; texto: string } {
  if (!e) return { ok: false, texto: "Não foi possível consultar o widget neste aparelho." };
  if (!e.grupo) return { ok: false, texto: "Widget sem acesso aos dados da VANT (App Group). Reinstale o app." };
  if (!e.temConta) return { ok: false, texto: "Sua conta ainda não foi enviada ao widget. Feche e abra a VANT." };
  if (!e.widgetLeuEm) return { ok: false, texto: "O widget ainda não leu os dados. Adicione-o à tela de início." };
  if (!e.widgetViuConta) return { ok: false, texto: `O widget leu às ${hora(e.widgetLeuEm)} sem a sua conta. Ele atualiza em instantes.` };
  return { ok: true, texto: `Widget conectado · leu às ${hora(e.widgetLeuEm)}${e.widgetPainelData ? " com o DEFCON de hoje" : ""}.` };
}

/** Minha Conta (iPhone): proof, on the phone itself, that the app and the widget share the data. */
export function DiagnosticoWidget() {
  // native state (not server state; same root key as quickKeys): re-read every 10 s while the card is on screen
  const { data } = useQuery({ queryKey: ["vant-quick", "estado"] as const, queryFn: quick.estado, refetchInterval: 10_000, staleTime: 0 });
  if (data === undefined) return null;
  const d = lerDiagnostico(data);
  return (
    <p role="status" className="text-[12px] font-semibold leading-snug" style={{ color: d.ok ? COR.ok : COR.apagado }}>
      {d.ok ? "✓ " : ""}{d.texto}
    </p>
  );
}
