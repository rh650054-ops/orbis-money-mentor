import DefconHub from "@/components/defcon/DefconHub";

export default function DailyGoals() {
  // O DEFCON acompanha o tema do app (claro/escuro) — sem trava de cor.
  return (
    <div className="bg-background text-foreground -mx-4 px-4 pt-3 pb-8">
      <DefconHub />
    </div>
  );
}
