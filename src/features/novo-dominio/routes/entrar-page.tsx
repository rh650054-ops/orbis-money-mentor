import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SkeletonCard } from "@/shared/components/skeletons";
import { useTrocarPasseMutation } from "../api/use-passe-mutations";
import { passeDoHash } from "../hooks/regra-aviso";

/** /entrar#passe=… — arrives from the old address already logged in, then shows how to install. */
export default function EntrarPage() {
  const navigate = useNavigate();
  const trocar = useTrocarPasseMutation();
  const [falhou, setFalhou] = useState(false);
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    const passe = passeDoHash(window.location.hash);
    // the code leaves the address bar and the history right away
    window.history.replaceState(null, "", window.location.pathname);
    if (!passe) { navigate("/auth", { replace: true }); return; }
    trocar.mutate(passe, {
      onSuccess: () => navigate("/install?de=orbis", { replace: true }),
      onError: () => setFalhou(true),
    });
  }, [navigate, trocar]);

  if (!falhou) {
    return (
      <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-[15px] font-bold" style={{ color: "#F4F1EA" }}>Entrando na sua conta…</p>
        <div className="w-full max-w-[360px]"><SkeletonCard /></div>
      </div>
    );
  }
  return (
    <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ color: "#F4F1EA" }}>
      <p className="text-[20px] font-black">Não consegui entrar sozinho</p>
      <p className="text-[14px] max-w-[340px]" style={{ color: "#BDB7AA" }}>
        O link expira em 10 minutos e só funciona uma vez. Entre com seu e-mail ou CPF e senha. Se esqueceu a senha, dá pra recuperar na tela de login.
      </p>
      <button type="button" onClick={() => navigate("/auth", { replace: true })}
        className="h-12 px-6 rounded-2xl font-black" style={{ background: "#F5B800", color: "#000" }}>
        Ir para o login
      </button>
    </div>
  );
}
