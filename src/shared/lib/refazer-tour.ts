/* Restart the whole welcome tour (Onboarding 2.0): profile flags + every
   "already seen" mark on this device, then open the onboarding. */
import { supabase } from "@/shared/api";
import { avisar } from "@/shared/lib/avisar";

export async function refazerTour(uid: string | undefined): Promise<void> {
  if (uid) {
    const { error } = await supabase.from("profiles").update({ onboarding_completed: false, onboarding_step: 0 }).eq("user_id", uid);
    if (error) {
      avisar.usuario("Não consegui reiniciar o tour. Tenta de novo.", error, "refazer tour");
      return;
    }
  }
  try {
    Object.keys(localStorage)
      .filter((k) =>
        k.startsWith("orbis_intro_vista_") || k.startsWith("orbis_screen_seen_") ||
        [`orbis_primeiros_passos_ok_${uid}`, `orbis_tour_celebrado_${uid}`, `orbis_plano_revelado_${uid}`,
          `orbis_visitou_ranking_${uid}`, `orbis_defcon_tour_ok_${uid}`, `orbis_mission_completed_${uid}`].includes(k))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(`orbis_onboarding_novo_${uid}`, "1");
  } catch (e) {
    avisar.silencioso("refazer tour: limpar marcações no aparelho", e);
  }
  window.location.assign("/onboarding-novo");
}
