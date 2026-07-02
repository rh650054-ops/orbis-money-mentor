import DefconHub from "@/components/defcon/DefconHub";
import { CompetitionStatementUpload } from "@/components/defcon/CompetitionStatementUpload";
import { useAuth } from "@/hooks/useAuth";

export default function DailyGoals() {
  const { user } = useAuth();
  // O DEFCON acompanha o tema do app (claro/escuro) — sem trava de cor.
  return (
    <div className="bg-background text-foreground -mx-4 px-4 pt-3 pb-8 min-h-[72vh]">
      {/* Bloco pra subir/ver o extrato do dia direto na Foco (mostra o status do envio). */}
      {user && (
        <div className="mb-3">
          <CompetitionStatementUpload userId={user.id} />
        </div>
      )}
      <DefconHub />
    </div>
  );
}
