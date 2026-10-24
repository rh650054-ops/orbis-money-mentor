/* "VOCÊ FOI DESAFIADO" em qualquer tela do app, inclusive no DEFCON (Rick, 24/10/2026).
   Antes o convite só existia nas telas de Ranking e Competições. */
import { useAuth } from "@/hooks/useAuth";
import X1InvitePopup from "./X1InvitePopup";

export default function X1ConviteGlobal() {
  const { user } = useAuth();
  return user ? <X1InvitePopup userId={user.id} /> : null;
}
