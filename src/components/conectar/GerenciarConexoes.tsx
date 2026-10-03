/* ============================================================
   GERENCIAR CONEXÕES — desconectar um banco (Rick, 03/10/2026).
   Dois toques, sem janela do navegador: "Desconectar" vira "Confirmar".
   Quem desconecta é o servidor (pluggy-desligar): a Pluggy apaga o acesso
   e a conexão sai da Vant. O que já foi lido fica no histórico.
   ============================================================ */
import { useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { toast } from "@/shared/hooks/use-toast";
import { desligarBanco, horaBR, saudeDoBanco, type BancoLigado } from "@/components/conectar/pluggy";

const RED = "#ff6b7a";
const MUTE = "#8a857c";

export function GerenciarConexoes({ aberto, onAbrir, bancos, onMudou }: {
  aberto: boolean; onAbrir: (v: boolean) => void; bancos: BancoLigado[]; onMudou: () => void;
}) {
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [saindo, setSaindo] = useState<string | null>(null);

  const desligar = async (b: BancoLigado) => {
    setSaindo(b.id);
    const r = await desligarBanco(b.id);
    setSaindo(null);
    setConfirmar(null);
    if (!r.ok) {
      toast({ title: "Não deu pra desconectar", description: "Tenta de novo em instantes.", variant: "destructive" });
      return;
    }
    toast({ title: `${r.banco} desconectado`, description: "A Vant parou de ler esse banco." });
    onMudou();
    if (bancos.length <= 1) onAbrir(false);
  };

  return (
    <Sheet open={aberto} onOpenChange={(v) => { onAbrir(v); if (!v) setConfirmar(null); }}>
      <SheetContent side="bottom" className="rounded-t-[24px] border-0 px-4 pb-8 pt-5" style={{ background: "#0d0d0f" }}>
        <SheetTitle className="text-[17px] font-black">Gerenciar conexões</SheetTitle>
        <p className="text-[12px] mt-1 leading-relaxed" style={{ color: MUTE }}>
          Desconectando, a Vant para de ler o banco na hora. O que já entrou fica no seu histórico.
          {bancos.length <= 1 ? " Sem nenhum banco ligado, o selo de verificado sai." : ""}
        </p>
        <div className="mt-3 rounded-[18px] px-3.5" style={{ background: "#111114", border: "1px solid #1f1e22" }}>
          {bancos.map((b, i) => {
            const s = saudeDoBanco(b.status, b.last_synced_at);
            const pedindo = confirmar === b.id;
            return (
              <div key={b.id} className="py-3" style={{ borderTop: i === 0 ? "none" : "1px solid #1f1e22" }}>
                <div className="flex items-center gap-3">
                  {b.institution_logo
                    ? <img src={b.institution_logo} alt="" className="w-10 h-10 rounded-[12px] shrink-0 object-contain p-1" style={{ background: "#fff" }} />
                    : <span className="w-10 h-10 rounded-[12px] shrink-0 flex items-center justify-center" style={{ background: "#16151a" }}><Landmark className="w-4 h-4" style={{ color: MUTE }} /></span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black truncate">{b.institution_name || "Banco"}</p>
                    <p className="text-[11px] truncate" style={{ color: s.alerta ? s.cor : MUTE }}>
                      {s.alerta ? s.texto : `conferido ${horaBR(b.last_synced_at)}`}
                    </p>
                  </div>
                  {!pedindo && (
                    <button type="button" onClick={() => setConfirmar(b.id)}
                      className="shrink-0 h-8 px-3 rounded-[10px] text-[11.5px] font-black"
                      style={{ color: RED, border: "1px solid rgba(255,107,122,.45)" }}>
                      Desconectar
                    </button>
                  )}
                </div>
                {pedindo && (
                  <div className="flex gap-2 mt-2.5">
                    <button type="button" onClick={() => setConfirmar(null)} disabled={!!saindo}
                      className="flex-1 h-10 rounded-[12px] text-[12.5px] font-black" style={{ background: "#1a1a1d", color: "#e9e6df" }}>
                      Cancelar
                    </button>
                    <button type="button" onClick={() => void desligar(b)} disabled={!!saindo}
                      className="flex-1 h-10 rounded-[12px] text-[12.5px] font-black inline-flex items-center justify-center gap-2"
                      style={{ background: RED, color: "#1a0508" }}>
                      {saindo === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Confirmar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
