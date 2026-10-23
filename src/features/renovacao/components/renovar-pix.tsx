/* "Renovar: pagar o Pix de R$ X" — the block screen, /assinar and the Foco warning share it.
   compacto: one line + button (Foco). Full: title, value, expiry, QR (web) and copy button. */
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/shared/ui/use-toast";
import type { RenovacaoPix } from "../api/use-renovacao-pix";
import { copiarPix, reais, venceTexto } from "../lib/pix";

const GOLD = "#F5B800";
const OK = "#3DD68C";

export function BotaoCopiarPix({ pix, rotulo, className, style }: { pix: RenovacaoPix; rotulo?: string; className?: string; style?: React.CSSProperties }) {
  const { toast } = useToast();
  const [ok, setOk] = useState(false);
  const copiar = async () => {
    const deu = await copiarPix(pix.pix_code);
    setOk(deu);
    toast(deu
      ? { title: "Pix copiado", description: "Abra o app do seu banco, escolha Pix copia e cola e confirme. Leva uns minutos pra liberar." }
      : { title: "Não consegui copiar", description: "Segure no código pra copiar à mão.", variant: "destructive" });
    if (deu) setTimeout(() => setOk(false), 4000);
  };
  return (
    <button type="button" onClick={copiar} className={className ?? "w-full h-[54px] rounded-[16px] inline-flex items-center justify-center gap-2 text-[15px] font-black active:translate-y-[1px]"}
      style={style ?? { background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 10px 24px -12px rgba(255,200,0,.8)" }}>
      {ok ? <Check className="w-4 h-4" strokeWidth={3} /> : <Copy className="w-4 h-4" strokeWidth={2.6} />}
      {ok ? "Copiado" : (rotulo ?? `Renovar: pagar o Pix de ${reais(pix.valor)}`)}
    </button>
  );
}

export function RenovarPix({ pix, titulo }: { pix: RenovacaoPix; titulo?: string }) {
  const [verCodigo, setVerCodigo] = useState(false);
  return (
    <div className="rounded-[20px] p-4 text-left" style={{ border: `1px solid ${GOLD}66`, background: "linear-gradient(170deg,#1a1305,#0e0e0f 70%)" }}>
      <p className="text-[11px] font-black tracking-[.14em]" style={{ color: GOLD }}>RENOVAÇÃO · {(pix.plano ?? "VANT").toUpperCase()}</p>
      <p className="text-[17px] font-black mt-1 leading-tight">{titulo ?? (pix.atrasada ? "Seu Pix de renovação está atrasado" : "Seu Pix de renovação já está pronto")}</p>
      <p className="text-[13px] mt-1" style={{ color: "#b9b3a6" }}>
        <b className="text-[#F4F1EA]">{reais(pix.valor)}</b> · {venceTexto(pix.vence_em)}. Paga e o acesso continua, sem assinar de novo.
      </p>
      <div className="mt-3"><BotaoCopiarPix pix={pix} /></div>
      {pix.pix_qrcode && (
        <img src={pix.pix_qrcode} alt="QR Code do Pix" width={160} height={160} loading="lazy" className="mx-auto mt-3 rounded-xl bg-white p-1.5 hidden sm:block" />
      )}
      <button type="button" onClick={() => setVerCodigo((v) => !v)} className="mt-2 text-[11.5px] font-bold underline underline-offset-[3px]" style={{ color: "#8a8378" }}>
        {verCodigo ? "esconder o código" : "ver o código do Pix"}
      </button>
      {verCodigo && <p className="mt-1.5 text-[10.5px] break-all font-mono select-all" style={{ color: OK }}>{pix.pix_code}</p>}
    </div>
  );
}
