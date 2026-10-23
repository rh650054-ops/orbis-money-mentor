/* Layout of the public store pages (/suporte, /excluir-conta): open without login,
   same look as /privacidade and /termos. */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export const SUPORTE_EMAIL = "suporte@vantapp.com.br";
export const SUPORTE_WHATSAPP = "https://wa.me/5511915054830?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20a%20Vant";

export function Secao({ t, children }: { t: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-foreground">{t}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export function PaginaPublica({ titulo, sub, Icone, children }: { titulo: string; sub: string; Icone: LucideIcon; children: ReactNode }) {
  const navigate = useNavigate();
  const voltar = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <button type="button" onClick={voltar} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{titulo}</h1>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
