import { useState } from "react";
import { Target, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  deadline: string;
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: "1",
      title: "Lucro Mensal",
      target: 5000,
      current: 3200,
      deadline: "2025-01-31",
    },
    {
      id: "2",
      title: "Meta Semanal",
      target: 1000,
      current: 750,
      deadline: "2025-01-05",
    },
  ]);

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    target: "",
    deadline: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newGoal: Goal = {
      id: Date.now().toString(),
      title: formData.title,
      target: parseFloat(formData.target),
      current: 0,
      deadline: formData.deadline,
    };

    setGoals([...goals, newGoal]);
    setOpen(false);
    setFormData({ title: "", target: "", deadline: "" });
    
    toast.success("Meta criada com sucesso!");
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getDaysRemaining = (deadline: string) => {
    const today = new Date();
    const end = new Date(deadline);
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return diff;
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Metas</h1>
          <p className="text-muted-foreground mt-1">
            Defina e acompanhe seus objetivos financeiros
          </p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow-primary">
              <Plus className="w-4 h-4 mr-2" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>Nova Meta</DialogTitle>
              <DialogDescription>
                Defina um objetivo financeiro para acompanhar
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título da Meta</Label>
                <Input
                  placeholder="Ex: Lucro Mensal"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Valor Objetivo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.target}
                  onChange={(e) =>
                    setFormData({ ...formData, target: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
              >
                Criar Meta
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Goals List */}
      <div className="grid gap-6 md:grid-cols-2">
        {goals.map((goal) => {
          const progress = calculateProgress(goal.current, goal.target);
          const daysRemaining = getDaysRemaining(goal.deadline);
          
          return (
            <Card key={goal.id} className="glass card-gradient-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{goal.title}</CardTitle>
                      <CardDescription>
                        {daysRemaining > 0
                          ? `${daysRemaining} dias restantes`
                          : "Meta vencida"}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-2xl font-bold text-success">
                      R$ {goal.current.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Atual</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      R$ {goal.target.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Meta</p>
                  </div>
                </div>

                {progress >= 100 ? (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-sm text-success font-medium text-center">
                      🎉 Meta alcançada! Parabéns!
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm text-primary font-medium text-center">
                      Faltam R$ {(goal.target - goal.current).toFixed(2)} para
                      atingir sua meta
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
