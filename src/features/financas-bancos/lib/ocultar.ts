/* "Hide values" on the Bancos screen, remembered on this device FOR THIS ACCOUNT. The key starts
   with "orbis_" so signing out clears it (useAuth.signOut), and it carries the account id so a
   second account on the same phone never inherits the first one's choice. */
import { useState } from "react";
import { reais } from "@/features/financas-resumo";

const chave = (userId: string | undefined) => `orbis_ocultar_valores:${userId ?? "anonimo"}`;
const ler = (userId: string | undefined) => { try { return localStorage.getItem(chave(userId)) === "1"; } catch { return false; } };

export function useOcultarValores(userId: string | undefined) {
  const [estado, setEstado] = useState(() => ({ dono: userId, oculto: ler(userId) }));
  // another account signed in on this screen: read ITS choice, never carry the previous one
  const oculto = estado.dono === userId ? estado.oculto : ler(userId);
  if (estado.dono !== userId) setEstado({ dono: userId, oculto });
  const alternar = () => {
    const novo = !oculto;
    try { localStorage.setItem(chave(userId), novo ? "1" : "0"); } catch { /* private window: only for this visit */ }
    setEstado({ dono: userId, oculto: novo });
  };
  return { oculto, alternar };
}

export const MASCARA = "R$ •••••";

/** A balance as the screen shows it: null = the bank did not send it (never shown as zero). */
export const dinheiro = (v: number | null | undefined, oculto: boolean) =>
  v == null ? "indisponível" : oculto ? MASCARA : v < 0 ? `− ${reais(Math.abs(v))}` : reais(v);
