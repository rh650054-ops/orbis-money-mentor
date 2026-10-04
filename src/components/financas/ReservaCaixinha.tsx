/* ============================================================
   SUA RESERVA = UMA CAIXINHA DO BANCO (04/10/2026, Mohamed)
   A reserva deixou de ser "uma conta inteira": a pessoa escolhe, entre as
   caixinhas/CDBs que o Open Finance lê de cada banco, qual é a reserva dela.
   O banco não manda o nome que a pessoa deu pra caixinha (chega como
   "CDB - ITAU UNIBANCO S.A."), então a escolha é pelo banco e pelo valor.
   Fica na aba Bancos das Finanças.
   ============================================================ */
import { useEffect, useState } from "react";
import { ChevronDown, LifeBuoy, Loader2, Check } from "lucide-react";
import { carregarCaixinhas, marcarReserva, type Caixinha } from "@/components/conectar/pluggy";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";

const AZUL = "#8cc4ff";
const SUB = "#b9b3a6";
const MUTE = "#7b766e";
const LINHA = "rgba(255,255,255,.07)";
const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");
const tipo = (c: Caixinha) => (c.tipo || "caixinha").replace(/_/g, " ").toLowerCase();

export function ReservaCaixinha({ userId }: { userId?: string }) {
  const [lista, setLista] = useState<Caixinha[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    void carregarCaixinhas().then((l) => { if (vivo) setLista(l); });
    return () => { vivo = false; };
  }, [userId]);

  if (!lista || lista.length === 0) return null;
  const marcadas = lista.filter((c) => c.reserva);
  const total = marcadas.reduce((t, c) => t + c.saldo, 0);
  const bancos = Array.from(new Set(lista.map((c) => c.banco ?? "Banco")));

  const alternar = async (c: Caixinha) => {
    setSalvando(c.id);
    const ok = await marcarReserva(c.id, !c.reserva);
    setSalvando(null);
    if (!ok) { toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" }); return; }
    setLista((l) => (l ?? []).map((x) => (x.id === c.id ? { ...x, reserva: !c.reserva } : x)));
  };

  return (
    <section className="orbis-card-in rounded-[18px] border px-4 py-3" style={{ background: "#0e0e10", borderColor: marcadas.length ? "rgba(90,176,255,.35)" : LINHA }}>
      <button type="button" onClick={() => setAberto((v) => !v)} className="w-full flex items-center gap-3 text-left" aria-expanded={aberto}>
        <span className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center" style={{ background: "rgba(90,176,255,.12)" }}>
          <LifeBuoy className="w-[17px] h-[17px]" style={{ color: AZUL }} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-black tracking-[.16em]" style={{ color: MUTE }}>SUA RESERVA</span>
          {marcadas.length > 0
            ? <span className="block text-[18px] font-black tabular-nums">{reais(total)} <span className="text-[12px] font-bold" style={{ color: SUB }}>em {marcadas.length} {marcadas.length === 1 ? "caixinha" : "caixinhas"}</span></span>
            : <span className="block text-[14px] font-extrabold" style={{ color: AZUL }}>Qual caixinha é a sua reserva?</span>}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 transition-transform" style={{ color: MUTE, transform: aberto ? "rotate(180deg)" : undefined }} />
      </button>

      {aberto && (
        <div className="mt-3">
          <p className="text-[12px] leading-relaxed" style={{ color: SUB }}>
            O banco não manda o nome que você deu pra caixinha, então escolhe pelo banco e pelo valor. Toca nas que são a sua reserva.
          </p>
          {bancos.map((b) => (
            <div key={b} className="mt-2.5">
              <p className="text-[10px] font-black tracking-[.14em] uppercase" style={{ color: MUTE }}>{b}</p>
              {lista.filter((c) => (c.banco ?? "Banco") === b).map((c, i) => (
                <button key={c.id} type="button" onClick={() => void alternar(c)} disabled={!!salvando} aria-pressed={c.reserva}
                  className="w-full flex items-center gap-3 py-2.5 text-left active:opacity-70" style={{ borderTop: i === 0 ? "none" : `1px solid ${LINHA}` }}>
                  <span className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center"
                    style={c.reserva ? { background: AZUL } : { border: "1.5px solid #3a3833" }}>
                    {salvando === c.id ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: c.reserva ? "#0b1520" : MUTE }} />
                      : c.reserva ? <Check className="w-3.5 h-3.5" style={{ color: "#0b1520" }} strokeWidth={3} /> : null}
                  </span>
                  <span className="flex-1 min-w-0 text-[13px] font-bold truncate" style={{ color: SUB }}>{tipo(c)}</span>
                  <span className="text-[15px] font-black tabular-nums">{reais(c.saldo)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
