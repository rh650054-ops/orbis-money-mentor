import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Casca comum de todas as telas de admin: botão de voltar pro Painel de
 * Comando (/admin), título, subtítulo e o mesmo respiro em volta do conteúdo.
 * Não tem lógica — só apresentação, pra tudo ter a mesma cara e sempre um
 * caminho de volta pro hub.
 */
interface AdminShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Pra onde o botão de voltar leva. Padrão: o Painel de Comando. */
  backTo?: string;
  /** Conteúdo à direita do cabeçalho (botões, contadores). */
  actions?: ReactNode;
  /** Largura máxima do miolo. */
  width?: "md" | "lg" | "xl";
  className?: string;
  children: ReactNode;
}

const WIDTHS: Record<NonNullable<AdminShellProps["width"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
};

export function AdminShell({ title, subtitle, icon, backTo = "/admin", actions, width = "lg", className = "", children }: AdminShellProps) {
  const navigate = useNavigate();
  return (
    <div className={`pt-2 pb-8 mx-auto space-y-4 ${WIDTHS[width]} ${className}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          aria-label="Voltar pro Painel de Comando"
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 leading-tight">
            {icon}
            <span className="truncate">{title}</span>
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export default AdminShell;
