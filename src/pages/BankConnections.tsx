/* ============================================================
   /bank-connections — tela antiga do "Open Finance em breve".
   O Open Finance de verdade virou a tela /verificar (conectar Mercado Pago,
   PagBank e ganhar o selo). Aqui só redirecionamos, pra não quebrar link
   antigo, atalho salvo nem o tour de onboarding.
   ============================================================ */
import { Navigate } from "react-router-dom";

export default function BankConnections() {
  return <Navigate to="/verificar" replace />;
}
