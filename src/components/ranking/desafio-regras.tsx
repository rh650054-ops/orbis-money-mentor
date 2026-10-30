/* "Ver regras" drawer for the Desafio Avante. Copy kept to what is already decided
   (period, prize, close time, verification); Rick reviews the wording. */
import { ShieldCheck } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/drawer";
import { PREMIO_MES, PREMIO_SEMANA } from "./premiacao";

const REGRAS: [string, string][] = [
  ["Mensal", `R$ ${PREMIO_MES} pro 1º lugar do Ranking do mês. Vale de 01/11 a 30/11, fecha dia 30 às 23:59 (Brasília).`],
  ["Semanal", `R$ ${PREMIO_SEMANA} pro 1º lugar de cada semana de novembro. A semana vai de domingo a sábado e fecha sábado às 23:59.`],
  ["Como conta", "Vale o faturamento lançado na VANT. Pra quem tem banco conectado, vale o que caiu no banco."],
  ["Verificação", "Antes de pagar, a equipe VANT confere as vendas do ganhador. Venda lançada de forma irregular desclassifica."],
  ["Pagamento", "A equipe VANT chama o ganhador no WhatsApp e paga o prêmio via Pix."],
];

export function DesafioRegras({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  return (
    <Drawer open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DrawerContent className="px-5 pb-8">
        <DrawerTitle className="text-[18px] font-black text-center mt-3">Regras do Desafio Avante</DrawerTitle>
        <ol className="mt-4 space-y-3">
          {REGRAS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="orbis-num w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-black" style={{ background: "rgba(245,184,0,.14)", color: "#F5B800" }}>{i + 1}</span>
              <p className="text-[13.5px] leading-snug" style={{ color: "#b9b3a6" }}><b className="text-white">{t}.</b> {d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px]" style={{ color: "#8f897c" }}>
          <ShieldCheck className="w-4 h-4" /> Premiação sujeita à verificação.
        </p>
      </DrawerContent>
    </Drawer>
  );
}
