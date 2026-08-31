import DefconHub from "@/components/defcon/DefconHub";
import FirstTimeCard from "@/components/FirstTimeCard";
import { useAuth } from "@/hooks/useAuth";

export default function DailyGoals() {
  const { user } = useAuth();
  // O DEFCON acompanha o tema do app (claro/escuro) — sem trava de cor.
  return (
    <div className="bg-background text-foreground -mx-4 px-4 pt-3 pb-8">
      <DefconHub />
      {/* Direcionamento inicial: 1ª vez no Modo Foco */}
      <FirstTimeCard tela="foco" userId={user?.id} />
    </div>
  );
}
