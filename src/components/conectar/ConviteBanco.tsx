/* ============================================================
   CONVITE PRA CONECTAR O BANCO — primeira tela da aba Vender pra quem não
   tem banco ligado (1A do mockup Open Finance, fluxo aprovado em 03/10/2026).
   Uma decisão só: CONECTAR MEU BANCO. Quem não é Pro vai pra paywall (/pro);
   quem já é Pro abre o widget do banco direto.
   ============================================================ */
import { Landmark } from "lucide-react";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";

const GOLD = "#F5B800";
const MUTE = "#7b766e";

const GANHOS: { icone: string; titulo: string; texto: string }[] = [
  { icone: "✅", titulo: "Selo de conferido no ranking", texto: "ninguém duvida do seu número" },
  { icone: "⚔️", titulo: "X1 e Sala de Competição", texto: "só quem tem banco ligado luta" },
  { icone: "💸", titulo: "Pix contado sozinho", texto: "vê o que já caiu enquanto vende" },
  { icone: "🧾", titulo: "Gastos organizados", texto: "mercado, mercadoria, contas: sem digitar" },
  { icone: "📄", titulo: "Comprovante de renda Vant", texto: "pra alugar casa e pedir crédito" },
];

export function ConviteBanco({ onConectar, rodape = "No Vant Pro a partir de R$ 34,90/mês · ou R$ 12,90 no Essencial" }: { onConectar: () => void; rodape?: string }) {
  return (
    <div className="space-y-3">
      <div className="rounded-[20px] border text-center" style={{ padding: "18px 12px", background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", borderColor: "rgba(245,184,0,.42)" }}>
        <span className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(245,184,0,.1)", border: "2px dashed rgba(245,184,0,.5)" }}>
          <Landmark className="w-6 h-6" style={{ color: GOLD }} strokeWidth={2} />
        </span>
        <p className="text-[19px] font-black mt-3 text-balance leading-tight">Liga seu banco e vira vendedor conferido <SeloVerificado size={16} className="inline -mt-1" /></p>
        <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "#b9b3a6" }}>A Vant lê seu extrato (só leitura) e faz o resto sozinha.</p>
      </div>

      <div className="rounded-[20px] border px-3.5 pt-1 pb-1" style={{ background: "#0f0f10", borderColor: "rgba(255,255,255,.07)" }}>
        <p className="text-[10px] font-black tracking-[.15em] pt-2.5 pb-1" style={{ color: GOLD }}>O QUE MUDA PRA VOCÊ</p>
        {GANHOS.map((g) => (
          <div key={g.titulo} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
            <span className="w-9 h-9 rounded-[11px] flex items-center justify-center text-[16px] shrink-0" style={{ background: "#1a1a19" }}>{g.icone}</span>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold leading-tight">{g.titulo}</p>
              <p className="text-[10.5px] font-bold mt-0.5" style={{ color: MUTE }}>{g.texto}</p>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={onConectar}
        className="w-full h-[50px] rounded-[14px] inline-flex items-center justify-center gap-2 text-[14px] font-black active:translate-y-[1px] transition-transform"
        style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 10px 24px -12px rgba(255,200,0,.8)" }}>
        <Landmark className="w-[18px] h-[18px]" strokeWidth={2.4} /> CONECTAR MEU BANCO
      </button>
      <p className="text-[10.5px] font-bold text-center" style={{ color: MUTE }}>{rodape}</p>
    </div>
  );
}
