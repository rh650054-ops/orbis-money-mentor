/* Conta de teste (Rick, 07/10/2026): botão no Perfil que apaga os dados de trabalho
   DESTA conta e recomeça o teste no dia escolhido — dia 0 passa pelo onboarding de novo.
   Só aparece pra contas marcadas em contas_teste; o banco confere de novo na função. */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

type Rpc = (n: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
type From = (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } } };

const DIAS = [
  { dia: 0, rotulo: "Dia 0", sub: "com onboarding" },
  { dia: 1, rotulo: "Dia 1", sub: "" },
  { dia: 2, rotulo: "Dia 2", sub: "" },
  { dia: 3, rotulo: "Dia 3", sub: "último" },
  { dia: 4, rotulo: "Acabou", sub: "bloqueio" },
];

/** Limpa o que o aparelho guarda de "já visto/feito" pra conta parecer nova. */
function limparAparelho(uid: string) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.includes(uid) || k.startsWith("orbis_intro_vista_") || k.startsWith("orbis_screen_seen_") || k === "vant_simular_teste")
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch (e) { avisar.silencioso("conta teste: limpar aparelho", e); }
}

export function RecomecarTeste({ userId }: { userId: string }) {
  const [ehTeste, setEhTeste] = useState(false);
  const [dia, setDia] = useState(0);
  const [indo, setIndo] = useState(false);

  useEffect(() => {
    void (supabase.from as unknown as From)("contas_teste").select("user_id").eq("user_id", userId).maybeSingle()
      .then(({ data }) => setEhTeste(!!data));
  }, [userId]);

  if (!ehTeste) return null;

  const recomecar = async () => {
    if (!window.confirm(`Apagar produtos, vendas e Focos desta conta de teste e recomeçar no ${dia === 4 ? "fim do teste" : `dia ${dia}`}?`)) return;
    setIndo(true);
    const { error } = await (supabase.rpc as unknown as Rpc)("conta_teste_recomecar", { p_dia: dia });
    if (error) { setIndo(false); avisar.usuario("Não consegui recomeçar a conta de teste.", error, "conta teste: recomeçar"); return; }
    limparAparelho(userId);
    if (dia === 0) {
      try { localStorage.setItem(`orbis_onboarding_novo_${userId}`, "1"); } catch { /* ok */ }
      window.location.assign("/onboarding-novo");
    } else {
      window.location.assign("/");
    }
  };

  return (
    <section className="rounded-[18px] p-4 space-y-3" style={{ background: "#120d1f", border: "1px solid rgba(124,58,237,.5)" }}>
      <div>
        <p className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#a78bfa" }}>CONTA DE TESTE</p>
        <p className="text-[15px] font-black mt-1">Recomeçar como vendedor novo</p>
        <p className="text-[12px] mt-1" style={{ color: "#b9b3a6" }}>Apaga produtos, vendas e Focos desta conta e começa o teste no dia escolhido. Assinatura e pagamentos não mudam.</p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {DIAS.map((d) => (
          <button key={d.dia} type="button" onClick={() => setDia(d.dia)} className="rounded-[10px] py-2 text-[12px] font-black leading-tight"
            style={dia === d.dia ? { background: "#7c3aed", color: "#fff" } : { background: "#1a1626", color: "#c4b5fd" }}>
            {d.rotulo}{d.sub && <span className="block text-[9px] font-bold opacity-80">{d.sub}</span>}
          </button>
        ))}
      </div>
      <button type="button" onClick={recomecar} disabled={indo} className="w-full h-11 rounded-[12px] text-[13px] font-black disabled:opacity-60"
        style={{ background: "#7c3aed", color: "#fff" }}>
        {indo ? "Recomeçando…" : "Apagar e recomeçar"}
      </button>
    </section>
  );
}
