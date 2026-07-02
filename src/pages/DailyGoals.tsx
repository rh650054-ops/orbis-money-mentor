import DefconHub from "@/components/defcon/DefconHub";
import { CompetitionStatementUpload } from "@/components/defcon/CompetitionStatementUpload";
import { useAuth } from "@/hooks/useAuth";

export default function DailyGoals() {
  const { user } = useAuth();
  // O DEFCON acompanha o tema do app (claro/escuro) — sem trava de cor.
  return (
    <div className="bg-background text-foreground -mx-4 px-4 pt-3 pb-8 min-h-[72vh]">
      <DefconHub />
      {/* Bloco pra subir/ver o extrato do dia — abaixo do bloco do DEFCON. */}
      {user && (
        <div className="mt-3">
          <CompetitionStatementUpload userId={user.id} />
        </div>
      )}
    </div>
  );
}
