/* ============================================================
   CAÇA-SINAL · "Seu ponto de hoje" — folha de 1 toque no fim do DEFCON.
   Liga a sessão a um semáforo (osm_id), pede avaliação (bom/médio/ruim),
   tempo do sinal (curto/médio/longo) e se pode compartilhar (agregado,
   3+ vendedores). Detecta o ponto pelo último GPS do DEFCON quando existe;
   senão oferece os pontos onde a pessoa já vendeu.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { getUltimaPosicao } from "@/shared/lib/gps-last";
import { ThumbsUp, ThumbsDown, Minus, MapPin, Loader2, Check, Eye, EyeOff } from "lucide-react";

const GOLD = "#F5B800";
const OK = "#3DD68C";

type Sinal = { osm_id: number; lat: number; lng: number; vias: string | null; distancia_m?: number };
type Rating = "bom" | "medio" | "ruim";
type Duracao = "curto" | "medio" | "longo";

const chave = (sid: string) => `orbis_sinal_perguntado_${sid}`;

export function nomeDoSinal(s: { vias: string | null; osm_id: number }) {
  return s.vias && s.vias.trim() ? s.vias : `Sinal #${String(s.osm_id).slice(-4)}`;
}

export function DefconSinalSheet({ sessionId, userId, totalSold }: { sessionId: string; userId: string; totalSold: number }) {
  const [open, setOpen] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [detectado, setDetectado] = useState<Sinal | null>(null);
  const [opcoes, setOpcoes] = useState<Sinal[]>([]);
  const [escolhido, setEscolhido] = useState<Sinal | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [duracao, setDuracao] = useState<Duracao | null>(null);
  const [compartilha, setCompartilha] = useState(true);
  const [prefConhecida, setPrefConhecida] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (localStorage.getItem(chave(sessionId)) === "1") return;
      } catch { /* nada */ }
      // Já respondeu essa sessão no banco? (outro aparelho)
      const { data: sess } = await supabase.from("challenge_sessions").select("sinal_osm_id").eq("id", sessionId).maybeSingle();
      if (!vivo) return;
      if ((sess as { sinal_osm_id?: number | null } | null)?.sinal_osm_id) return;

      const [{ data: prof }, meus] = await Promise.all([
        supabase.from("profiles").select("compartilha_pontos").eq("user_id", userId).maybeSingle(),
        (supabase as any).rpc("caca_sinal_meus"),
      ]);
      if (!vivo) return;
      const pref = (prof as { compartilha_pontos?: boolean | null } | null)?.compartilha_pontos;
      if (pref === false) { setCompartilha(false); setPrefConhecida(true); }
      if (pref === true) { setCompartilha(true); setPrefConhecida(true); }

      const lista: Sinal[] = ((meus.data as any[]) || []).filter((m) => m.lat != null).slice(0, 5)
        .map((m) => ({ osm_id: Number(m.osm_id), lat: Number(m.lat), lng: Number(m.lng), vias: m.vias ?? null }));

      const pos = getUltimaPosicao();
      let det: Sinal | null = null;
      if (pos) {
        const { data } = await (supabase as any).rpc("caca_sinais_proximos_nome", { p_lat: pos.lat, p_lng: pos.lng, p_raio_km: 0.4 });
        if (!vivo) return;
        const perto = ((data as any[]) || []).map((s) => ({ osm_id: Number(s.osm_id), lat: Number(s.lat), lng: Number(s.lng), vias: s.vias ?? null, distancia_m: Number(s.distancia_m) }));
        if (perto[0] && perto[0].distancia_m <= 350) det = perto[0];
        for (const p of perto.slice(0, 4)) if (!lista.some((l) => l.osm_id === p.osm_id)) lista.push(p);
      }
      setDetectado(det);
      setEscolhido(det);
      setOpcoes(lista);
      setCarregando(false);
      // Sem GPS e sem histórico: não tem como perguntar — não incomoda.
      if (!det && lista.length === 0) return;
      setTimeout(() => vivo && setOpen(true), 1200);
    })().catch(() => {});
    return () => { vivo = false; };
  }, [sessionId, userId]);

  const marcarPerguntado = () => { try { localStorage.setItem(chave(sessionId), "1"); } catch { /* nada */ } };

  const fechar = () => { marcarPerguntado(); setOpen(false); };

  const salvar = async () => {
    if (!escolhido || !rating || salvando) return;
    setSalvando(true);
    const pos = getUltimaPosicao();
    const { error } = await supabase.from("challenge_sessions").update({
      sinal_osm_id: escolhido.osm_id,
      sinal_rating: rating,
      sinal_duracao: duracao,
      sinal_compartilha: compartilha,
      sinal_lat: pos ? Math.round(pos.lat * 1000) / 1000 : null,
      sinal_lng: pos ? Math.round(pos.lng * 1000) / 1000 : null,
    } as never).eq("id", sessionId);
    if (!error) {
      await supabase.from("profiles").update({ compartilha_pontos: compartilha } as never).eq("user_id", userId);
      if (duracao) {
        await (supabase as any).from("caca_sinal_duracoes").upsert({ user_id: userId, osm_id: escolhido.osm_id, duracao }, { onConflict: "user_id,osm_id" });
      }
    }
    setSalvando(false);
    if (error) { toast({ title: "Não deu pra salvar o ponto", variant: "destructive" }); return; }
    toast({ title: "Ponto registrado no Caça-Sinal", description: compartilha ? "Você vai ver os dados dos outros vendedores lá." : "Só você vê esse histórico." });
    fechar();
  };

  const titulo = useMemo(() => {
    if (escolhido) return <>Você vendeu <span style={{ color: GOLD }}>{formatCurrency(totalSold)}</span> em {nomeDoSinal(escolhido)}</>;
    return <>Você vendeu <span style={{ color: GOLD }}>{formatCurrency(totalSold)}</span>. Em qual ponto?</>;
  }, [escolhido, totalSold]);

  if (carregando) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) fechar(); }}>
      <SheetContent side="bottom" className="rounded-t-[24px] border-t p-0 max-h-[92vh] overflow-y-auto [&>button]:hidden" style={{ background: "#0e0e10", borderColor: "#2a2416" }}>
        <SheetTitle className="sr-only">Seu ponto de hoje</SheetTitle>
        <div className="px-[18px] pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 22px)" }}>
          <div className="w-10 h-1 rounded-full mx-auto mb-3.5" style={{ background: "#2c2a24" }} />
          <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>CAÇA-SINAL · SEU PONTO DE HOJE</p>
          <h3 className="text-[20px] font-black tracking-tight leading-tight mt-1.5 text-foreground">{titulo}</h3>
          <p className="text-xs mt-1.5" style={{ color: "#8a8378" }}>
            {detectado && escolhido?.osm_id === detectado.osm_id
              ? "Detectado pelo GPS do DEFCON."
              : "Escolha o semáforo onde você ficou hoje."}
            {" "}Isso vira histórico seu e ajuda a comunidade a achar sinal bom.
          </p>

          {/* escolha do ponto */}
          {(!escolhido || trocando) ? (
            <div className="mt-3 space-y-2">
              {opcoes.map((o) => (
                <button key={o.osm_id} type="button" onClick={() => { setEscolhido(o); setTrocando(false); }}
                  className="w-full flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-left active:scale-[0.99] transition-transform"
                  style={{ background: "#0a0a0d", border: `1px solid ${escolhido?.osm_id === o.osm_id ? GOLD : "#2a2823"}` }}>
                  <MapPin className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-foreground truncate">{nomeDoSinal(o)}</span>
                    {o.distancia_m != null && <span className="block text-[11px]" style={{ color: "#8a8378" }}>a {o.distancia_m} m de você</span>}
                  </span>
                </button>
              ))}
              <button type="button" onClick={fechar} className="w-full text-center text-[12px] py-2" style={{ color: "#8a8378" }}>não vendi num sinal hoje</button>
            </div>
          ) : (
            <>
              {opcoes.length > 1 && (
                <button type="button" onClick={() => setTrocando(true)} className="text-[12px] font-bold mt-2" style={{ color: GOLD }}>não era esse ponto · trocar</button>
              )}

              {/* avaliação */}
              <p className="text-[10px] font-black tracking-[.14em] mt-4" style={{ color: "#8a8378" }}>COMO FOI O PONTO?</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {([["bom", "Bom", ThumbsUp, OK], ["medio", "Médio", Minus, "#e9e4d8"], ["ruim", "Ruim", ThumbsDown, "#F2465A"]] as const).map(([k, l, Icon, cor]) => {
                  const on = rating === k;
                  return (
                    <button key={k} type="button" onClick={() => setRating(k)}
                      className="h-16 rounded-[14px] flex flex-col items-center justify-center gap-1 text-xs font-black active:scale-95 transition-transform"
                      style={on ? { background: k === "bom" ? "#0d1f16" : k === "ruim" ? "#2a0c11" : "#1a1305", border: `1px solid ${cor}`, color: cor } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
                      <Icon className="w-5 h-5" strokeWidth={2.4} />
                      {l}
                    </button>
                  );
                })}
              </div>

              {/* tempo do sinal */}
              <p className="text-[10px] font-black tracking-[.14em] mt-4" style={{ color: "#8a8378" }}>QUANTO TEMPO O SINAL FICA FECHADO?</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {([["curto", "Curto", "até 30s"], ["medio", "Médio", "30–60s"], ["longo", "Longo", "mais de 60s"]] as const).map(([k, l, s]) => {
                  const on = duracao === k;
                  return (
                    <button key={k} type="button" onClick={() => setDuracao(k)}
                      className="h-14 rounded-[14px] flex flex-col items-center justify-center text-xs font-black active:scale-95 transition-transform"
                      style={on ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
                      {l}
                      <span className="text-[10px] font-semibold" style={{ color: on ? GOLD : "#8a8378" }}>{s}</span>
                    </button>
                  );
                })}
              </div>

              {/* compartilhar */}
              <button type="button" onClick={() => setCompartilha((v) => !v)}
                className="w-full mt-4 flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-left"
                style={{ background: "#0a0a0d", border: `1px solid ${compartilha ? "rgba(61,214,140,.4)" : "#2a2823"}` }}>
                {compartilha ? <Eye className="w-4 h-4 shrink-0" style={{ color: OK }} /> : <EyeOff className="w-4 h-4 shrink-0" style={{ color: "#8a8378" }} />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-foreground">{compartilha ? "Compartilhar com a comunidade" : "Só pra mim"}</span>
                  <span className="block text-[11px]" style={{ color: "#8a8378" }}>
                    {compartilha ? "Entra no mapa só somado com 3+ vendedores. Ninguém vê seu nome nem seu valor." : "Seu histórico fica privado e você não vê o dos outros."}
                    {!prefConhecida ? " Você pode mudar depois." : ""}
                  </span>
                </span>
                <span className="w-10 h-6 rounded-full relative shrink-0" style={{ background: compartilha ? OK : "#2a2823" }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: compartilha ? 18 : 2 }} />
                </span>
              </button>

              <button type="button" disabled={!rating || salvando} onClick={salvar} className="orbis-cta w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-40" style={{ height: 52 }}>
                {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" strokeWidth={3} />}
                SALVAR PONTO
              </button>
              <button type="button" onClick={fechar} className="w-full text-center text-[12px] py-2 mt-1" style={{ color: "#8a8378" }}>agora não</button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
