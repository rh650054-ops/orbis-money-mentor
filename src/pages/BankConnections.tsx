import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Building2, Clock, FileText } from "lucide-react";

// Open Finance ainda NÃO está no ar. Tela em modo "em breve" (cinza) + aviso, e
// manda o usuário enviar o EXTRATO por enquanto (é assim que as vendas contam hoje).
// Novos usuários perguntam bastante do Open Finance — aqui a gente explica e direciona.
export default function BankConnections() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Bloco Open Finance — desativado / em breve (cinza) */}
      <div className="rounded-2xl border border-border bg-card/40 p-6 text-center space-y-4 opacity-90 grayscale">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center relative">
          <Building2 className="w-8 h-8 text-muted-foreground" />
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
            <Clock className="w-4 h-4 text-muted-foreground" />
          </span>
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Conectar meu banco (Open Finance)</h1>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Clock className="w-3.5 h-3.5" /> Em breve
          </p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Estamos finalizando a conexão automática com o seu banco (Nubank, Itaú, C6 e +200).
          Quando estiver no ar, suas vendas por Pix entram <b className="text-foreground">sozinhas</b> no app — sem digitar nada.
        </p>
      </div>

      {/* Por enquanto: envie o extrato */}
      <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-center space-y-3">
        <p className="text-sm text-foreground leading-relaxed">
          <b>Enquanto isso</b>, é só enviar o seu <b>extrato do dia</b> — a IA confere na hora e o valor
          entra no ranking. Simples assim.
        </p>
        <Button onClick={() => navigate("/daily-goals")} className="w-full gap-2 h-11">
          <FileText className="w-4 h-4" /> Mandar extrato
        </Button>
      </div>
    </div>
  );
}
