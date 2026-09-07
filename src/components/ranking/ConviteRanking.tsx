import { useEffect, useState } from "react";
import { Camera, Instagram, Check, Loader2, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";

/**
 * Convite da PRIMEIRA visita ao ranking: "coloca uma foto e o seu Instagram
 * pros outros competidores te verem". Some quando o vendedor completa os dois
 * ou toca em "Agora nao" (memoria em localStorage por usuario).
 */
const chave = (uid: string) => `orbis_ranking_convite_${uid}`;

function lembrarDispensa(uid: string) {
  try { localStorage.setItem(chave(uid), "1"); } catch { /* nada */ }
}
function foiDispensado(uid: string) {
  try { return localStorage.getItem(chave(uid)) === "1"; } catch { return true; }
}

const GOLD = "#F5B800";

export function ConviteRanking({
  userId, temFoto, instagram, onFoto, enviandoFoto, onSalvou,
}: {
  userId: string;
  temFoto: boolean;
  instagram: string;
  onFoto: () => void;
  enviandoFoto: boolean;
  onSalvou: () => void;
}) {
  const [oculto, setOculto] = useState(() => foiDispensado(userId));
  const [editandoIg, setEditandoIg] = useState(false);
  const [ig, setIg] = useState("");
  const [salvando, setSalvando] = useState(false);

  const temIg = instagram.trim().length > 0;
  const completo = temFoto && temIg;

  // Completou os dois: some sozinho e nao volta mais.
  useEffect(() => {
    if (completo) lembrarDispensa(userId);
  }, [completo, userId]);

  if (oculto || completo) return null;

  const dispensar = () => {
    lembrarDispensa(userId);
    setOculto(true);
  };

  const salvarIg = async () => {
    const limpo = ig.trim().replace(/^@/, "").replace(/\s+/g, "");
    if (!limpo) { setEditandoIg(false); return; }
    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({ instagram: limpo, show_instagram: true })
      .eq("user_id", userId);
    setSalvando(false);
    if (error) {
      toast({ title: "Não deu pra salvar o Instagram", description: "Tente de novo.", variant: "destructive" });
      return;
    }
    toast({ title: `@${limpo} no seu perfil do ranking` });
    setEditandoIg(false);
    onSalvou();
  };

  return (
    <div
      className="orbis-card-in rounded-2xl p-4 relative"
      style={{ background: "linear-gradient(160deg,#1a1305,#0e0e10)", border: `1px solid ${GOLD}66`, boxShadow: `0 0 18px ${GOLD}22` }}
    >
      <button onClick={dispensar} aria-label="Fechar" className="absolute top-2.5 right-2.5 p-1 text-[#8a8378]">
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 pr-6">
        <Eye className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
        <p className="text-sm font-black text-white leading-tight">Deixa os concorrentes te verem</p>
      </div>
      <p className="text-[12px] mt-1" style={{ color: "#b3ab9c" }}>
        Quem tem foto e Instagram no ranking recebe mais desafios e mais seguidores. Leva 20 segundos.
      </p>

      <div className="mt-3 space-y-2">
        {/* FOTO */}
        <button
          onClick={temFoto ? undefined : onFoto}
          disabled={temFoto || enviandoFoto}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left active:scale-[0.99] transition-transform disabled:opacity-100"
          style={{ background: "#0a0a0d", border: `1px solid ${temFoto ? "#3DD68C66" : "#2a2416"}` }}
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: temFoto ? "#3DD68C22" : `${GOLD}22` }}>
            {enviandoFoto ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
              : temFoto ? <Check className="w-4 h-4" style={{ color: "#3DD68C" }} />
              : <Camera className="w-4 h-4" style={{ color: GOLD }} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-white">{temFoto ? "Foto no ranking" : "Adicionar foto"}</span>
            <span className="block text-[11px]" style={{ color: "#8a8378" }}>{temFoto ? "Pronto, todo mundo já te vê" : "Só aparece aqui no ranking"}</span>
          </span>
          {!temFoto && <span className="text-[11px] font-black" style={{ color: GOLD }}>ESCOLHER</span>}
        </button>

        {/* INSTAGRAM */}
        {editandoIg ? (
          <div className="rounded-xl px-3 py-2.5" style={{ background: "#0a0a0d", border: `1px solid ${GOLD}66` }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black" style={{ color: GOLD }}>@</span>
              <input
                autoFocus
                value={ig}
                onChange={(e) => setIg(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") salvarIg(); }}
                placeholder="seu.instagram"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white placeholder:text-[#5a5449]"
              />
              <button
                onClick={salvarIg}
                disabled={salvando}
                className="h-8 px-3 rounded-lg text-[11px] font-black"
                style={{ background: GOLD, color: "#1a1305" }}
              >
                {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "SALVAR"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={temIg ? undefined : () => setEditandoIg(true)}
            disabled={temIg}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left active:scale-[0.99] transition-transform disabled:opacity-100"
            style={{ background: "#0a0a0d", border: `1px solid ${temIg ? "#3DD68C66" : "#2a2416"}` }}
          >
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: temIg ? "#3DD68C22" : `${GOLD}22` }}>
              {temIg ? <Check className="w-4 h-4" style={{ color: "#3DD68C" }} /> : <Instagram className="w-4 h-4" style={{ color: GOLD }} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-white">{temIg ? `@${instagram}` : "Adicionar Instagram"}</span>
              <span className="block text-[11px]" style={{ color: "#8a8378" }}>{temIg ? "Visível no seu perfil do ranking" : "Os competidores vão poder te seguir"}</span>
            </span>
            {!temIg && <span className="text-[11px] font-black" style={{ color: GOLD }}>ADICIONAR</span>}
          </button>
        )}
      </div>

      <button onClick={dispensar} className="w-full text-center text-[12px] mt-3 py-1" style={{ color: "#8a8378" }}>
        Agora não
      </button>
    </div>
  );
}
