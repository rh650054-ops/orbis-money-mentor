import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";

interface TimelineItem {
  id: string;
  activity_name: string;
  activity_time: string | null;
  completed: boolean;
  emoji?: string;
  status?: string;
}

interface VisualTimelineProps {
  items: TimelineItem[];
  currentTimeMinutes: number;
}

export default function VisualTimeline({ items, currentTimeMinutes }: VisualTimelineProps) {
  const getItemStatus = (item: TimelineItem) => {
    if (item.completed) return "completed";
    if (!item.activity_time) return "pending";
    
    const [h, m] = item.activity_time.split(":").map(Number);
    const itemMinutes = h * 60 + m;
    
    if (itemMinutes < currentTimeMinutes) return "late";
    if (itemMinutes <= currentTimeMinutes + 30) return "inProgress";
    return "pending";
  };

  const getLineProgress = () => {
    if (items.length === 0) return 0;
    
    const times = items
      .filter(i => i.activity_time)
      .map(i => {
        const [h, m] = i.activity_time!.split(":").map(Number);
        return h * 60 + m;
      });
    
    if (times.length === 0) return 0;
    
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const range = maxTime - minTime;
    
    if (range === 0) return 100;
    
    const progress = ((currentTimeMinutes - minTime) / range) * 100;
    return Math.max(0, Math.min(100, progress));
  };

  return (
    <div className="relative py-8 px-4">
      {/* Title */}
      <h3 className="text-lg font-bold gradient-text mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        Linha do Tempo Visionária
      </h3>

      {/* Main timeline container */}
      <div className="relative ml-8">
        {/* Background line */}
        <div className="absolute left-4 top-0 bottom-0 w-1 bg-muted rounded-full" />
        
        {/* Progress line */}
        <div 
          className="absolute left-4 top-0 w-1 bg-gradient-to-b from-primary via-secondary to-primary rounded-full transition-all duration-1000"
          style={{ height: `${getLineProgress()}%` }}
        />

        {/* Timeline items */}
        <div className="space-y-6">
          {items.map((item, index) => {
            const status = getItemStatus(item);
            
            return (
              <div 
                key={item.id}
                className="relative flex items-center gap-4 pl-8 group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Node/Point */}
                <div 
                  className={`absolute left-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 z-10 ${
                    status === "completed" 
                      ? "bg-success shadow-[0_0_20px_hsl(var(--success)/0.5)]" 
                      : status === "inProgress"
                      ? "bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.5)] animate-pulse"
                      : status === "late"
                      ? "bg-destructive shadow-[0_0_20px_hsl(var(--destructive)/0.5)]"
                      : "bg-muted border-2 border-muted-foreground/30"
                  }`}
                >
                  {status === "completed" ? (
                    <CheckCircle2 className="w-5 h-5 text-success-foreground" />
                  ) : status === "late" ? (
                    <AlertCircle className="w-5 h-5 text-destructive-foreground" />
                  ) : status === "inProgress" ? (
                    <div className="w-3 h-3 bg-primary-foreground rounded-full animate-ping" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                {/* Content card */}
                <div 
                  className={`flex-1 p-4 rounded-xl border transition-all duration-300 group-hover:scale-[1.02] ${
                    status === "completed"
                      ? "bg-success/10 border-success/30"
                      : status === "inProgress"
                      ? "bg-primary/10 border-primary/50 shadow-[0_0_30px_hsl(var(--primary)/0.2)]"
                      : status === "late"
                      ? "bg-destructive/10 border-destructive/30"
                      : "bg-card/50 border-border/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.emoji && (
                      <span className={`text-3xl transition-transform duration-300 group-hover:scale-125 ${
                        status === "completed" ? "grayscale" : ""
                      }`}>
                        {item.emoji}
                      </span>
                    )}
                    <div className="flex-1">
                      <p className={`font-semibold ${
                        status === "completed" ? "line-through text-muted-foreground" : ""
                      }`}>
                        {item.activity_name}
                      </p>
                      {item.activity_time && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {item.activity_time}
                        </p>
                      )}
                    </div>
                    
                    {/* Status indicator */}
                    {status === "inProgress" && (
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 animate-pulse">
                        AGORA
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
