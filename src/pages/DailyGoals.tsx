import DefconHub from "@/components/defcon/DefconHub";

export default function DailyGoals() {
  // O DEFCON é a "cabine" de foco — mantém escuro nos dois temas (legível e sem glare).
  return (
    <div className="dark bg-background text-foreground -mx-4 px-4 pt-3 pb-8 min-h-[72vh]">
      <DefconHub />
    </div>
  );
}

