/* Pro without a bank yet: one goal — connect it. */
import { Landmark, Loader2, Banknote, ReceiptText } from "lucide-react";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";
import { COR } from "@/shared/components/vant-ui";

const VANTAGENS = [
  { icone: <Banknote className="w-[18px] h-[18px]" style={{ color: COR.ok }} />, titulo: "Pix conferido sozinho", texto: "você vê o que caiu enquanto vende" },
  { icone: <SeloVerificado size={18} />, titulo: "Selo no ranking e no X1", texto: "ninguém duvida do seu número" },
  { icone: <ReceiptText className="w-[18px] h-[18px]" style={{ color: COR.ouro }} />, titulo: "Comprovante de renda", texto: "PDF com o que caiu, mês a mês" },
];

export function PrimeiroBanco({ pro, ligando, onLigar, onConferir }: { pro: boolean; ligando: boolean; onLigar: () => void; onConferir: () => void }) {
  return (
    <>
      <section className="rounded-[22px] p-5 text-center" style={{ background: `linear-gradient(170deg,#1a1305,${COR.card} 70%)`, border: "1px solid rgba(245,184,0,.42)" }}>
        <span className="w-16 h-16 rounded-full mx-auto grid place-items-center" style={{ background: "rgba(245,184,0,.1)", border: "2px dashed rgba(245,184,0,.5)" }}>
          <Landmark className="w-7 h-7" style={{ color: COR.ouro }} />
        </span>
        <p className="text-[19px] font-black mt-3">{pro ? "Falta um passo pro selo" : "Agora é ligar o banco"}</p>
        <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: COR.suave }}>Leva menos de 1 minuto. O Pix que cair no banco passa a ser conferido sozinho.</p>
        <button type="button" onClick={onLigar} disabled={ligando} data-tour="conectar-banco"
          className="mt-4 w-full h-12 rounded-[14px] inline-flex items-center justify-center gap-2 text-[14px] font-black transition-transform duration-100 active:scale-[0.97] disabled:opacity-60"
          style={{ background: COR.ouro, color: "#1A1200" }}>
          {ligando ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Landmark className="w-[18px] h-[18px]" />} {ligando ? "Abrindo…" : "Ligar meu banco"}
        </button>
        <p className="text-[11px] font-bold mt-2.5" style={{ color: COR.apagado }}>A senha é digitada no seu banco. A Vant não vê.</p>
      </section>
      <section className="rounded-[18px] px-4 divide-y divide-[#1b1a17]" style={{ background: COR.card, border: `1px solid ${COR.borda}` }}>
        {VANTAGENS.map((v) => (
          <div key={v.titulo} className="flex items-center gap-3 py-3">
            <span className="w-9 h-9 rounded-[11px] grid place-items-center shrink-0" style={{ background: "#1a1a19" }}>{v.icone}</span>
            <div><p className="text-[13.5px] font-extrabold">{v.titulo}</p><p className="text-[11.5px]" style={{ color: COR.apagado }}>{v.texto}</p></div>
          </div>
        ))}
      </section>
      <button type="button" onClick={onConferir} className="text-[12px] font-extrabold underline underline-offset-4" style={{ color: COR.apagado }}>
        Já liguei e não apareceu? Conferir de novo
      </button>
    </>
  );
}
