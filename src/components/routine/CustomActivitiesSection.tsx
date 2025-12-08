import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Sparkles, GripVertical, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const activitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  category: z.enum(["trabalho", "saude", "lazer", "estudo", "outro"]),
  emoji: z.string().min(1),
  notes: z.string().max(500).optional()
});

const EMOJI_OPTIONS = [
  { emoji: "💪", label: "Disciplina" },
  { emoji: "☀️", label: "Acordar" },
  { emoji: "🍬", label: "Vendas" },
  { emoji: "💸", label: "Meta batida" },
  { emoji: "🔥", label: "Treino" },
  { emoji: "☕", label: "Foco" },
  { emoji: "🧠", label: "Estudo" },
  { emoji: "🌙", label: "Descanso" },
  { emoji: "💼", label: "Trabalho" },
  { emoji: "🎯", label: "Meta" },
  { emoji: "📚", label: "Leitura" },
  { emoji: "🏃", label: "Exercício" },
];

const CATEGORY_COLORS: Record<string, string> = {
  trabalho: "from-primary/30 to-primary/10 border-primary/50",
  saude: "from-success/30 to-success/10 border-success/50",
  lazer: "from-warning/30 to-warning/10 border-warning/50",
  estudo: "from-secondary/30 to-secondary/10 border-secondary/50",
  outro: "from-muted/30 to-muted/10 border-muted-foreground/30",
};

interface Activity {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  category: string;
  emoji: string;
  notes: string;
}

interface CustomActivitiesSectionProps {
  userId: string;
  activities: Activity[];
  onActivitiesChange: () => void;
}

export default function CustomActivitiesSection({ 
  userId, 
  activities, 
  onActivitiesChange 
}: CustomActivitiesSectionProps) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    startTime: "",
    endTime: "",
    category: "trabalho",
    emoji: "💪",
    notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validation = activitySchema.safeParse(formData);
      if (!validation.success) {
        toast({
          title: "Erro de validação",
          description: validation.error.errors[0].message,
          variant: "destructive"
        });
        return;
      }

      if (editingId) {
        const { error } = await supabase
          .from("routine_activities")
          .update({
            name: formData.name.trim(),
            start_time: formData.startTime,
            end_time: formData.endTime,
            category: formData.category,
            emoji: formData.emoji,
            notes: formData.notes.trim(),
          })
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Atividade atualizada!" });
        setEditingId(null);
      } else {
        const { error } = await supabase
          .from("routine_activities")
          .insert({
            user_id: userId,
            name: formData.name.trim(),
            start_time: formData.startTime,
            end_time: formData.endTime,
            category: formData.category,
            emoji: formData.emoji,
            notes: formData.notes.trim(),
            display_order: activities.length
          });

        if (error) throw error;
        toast({ title: "Atividade adicionada!" });
      }

      resetForm();
      onActivitiesChange();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a atividade.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (activity: Activity) => {
    setFormData({
      name: activity.name,
      startTime: activity.start_time,
      endTime: activity.end_time,
      category: activity.category,
      emoji: activity.emoji,
      notes: activity.notes || ""
    });
    setEditingId(activity.id);
    setIsAdding(true);
  };

  const handleDelete = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("routine_activities")
        .delete()
        .eq("id", activityId);

      if (error) throw error;
      toast({ title: "Atividade removida!" });
      onActivitiesChange();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover a atividade.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      startTime: "",
      endTime: "",
      category: "trabalho",
      emoji: "💪",
      notes: ""
    });
    setIsAdding(false);
    setEditingId(null);
  };

  return (
    <Card className="relative overflow-hidden border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-card to-secondary/5">
      {/* Neon glow effect on border */}
      <div className="absolute inset-0 rounded-lg shadow-[inset_0_0_30px_hsl(var(--primary)/0.1)]" />
      
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            Atividades Personalizadas
          </CardTitle>
          {!isAdding && (
            <Button 
              onClick={() => setIsAdding(true)}
              size="sm"
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova Atividade
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Activity list */}
        {activities.length > 0 && (
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <div 
                key={activity.id}
                className={`group relative flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r ${
                  CATEGORY_COLORS[activity.category] || CATEGORY_COLORS.outro
                } border transition-all duration-300 hover:scale-[1.01]`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Drag handle */}
                <GripVertical className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                
                {/* Emoji */}
                <div className="w-14 h-14 rounded-2xl bg-card/80 flex items-center justify-center shadow-lg">
                  <span className="text-3xl">{activity.emoji}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg truncate">{activity.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {activity.start_time} - {activity.end_time} • {activity.category}
                  </p>
                  {activity.notes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{activity.notes}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(activity)}
                    className="hover:bg-primary/20 hover:text-primary"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(activity.id)}
                    className="hover:bg-destructive/20 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit form */}
        {isAdding && (
          <form 
            onSubmit={handleSubmit} 
            className="space-y-4 p-5 bg-gradient-to-br from-card/90 to-card/70 rounded-xl border border-primary/30 shadow-[0_0_30px_hsl(var(--primary)/0.1)]"
          >
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nome da Atividade</Label>
              <Input
                type="text"
                placeholder="Ex: Treinar, Estudar, Postar conteúdo..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={200}
                className="bg-card/50 border-primary/20 focus:border-primary"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Início</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                  className="bg-card/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Fim</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                  className="bg-card/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Emoji</Label>
              <div className="grid grid-cols-6 gap-2">
                {EMOJI_OPTIONS.map((option) => (
                  <button
                    key={option.emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, emoji: option.emoji })}
                    className={`text-3xl p-2 rounded-xl border-2 transition-all duration-200 hover:scale-110 ${
                      formData.emoji === option.emoji 
                        ? "border-primary bg-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.4)]" 
                        : "border-border/50 hover:border-primary/50"
                    }`}
                    title={option.label}
                  >
                    {option.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Categoria</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="bg-card/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trabalho">💼 Trabalho</SelectItem>
                  <SelectItem value="saude">💪 Saúde</SelectItem>
                  <SelectItem value="lazer">🎮 Lazer</SelectItem>
                  <SelectItem value="estudo">📚 Estudo</SelectItem>
                  <SelectItem value="outro">✨ Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Observações (opcional)</Label>
              <Textarea
                placeholder="Detalhes sobre a atividade..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                maxLength={500}
                className="bg-card/50"
              />
            </div>

            <div className="flex gap-3">
              <Button 
                type="submit"
                className="flex-1 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
              >
                {editingId ? "Salvar Alterações" : "Adicionar Atividade"}
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={resetForm}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {activities.length === 0 && !isAdding && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma atividade personalizada ainda.</p>
            <p className="text-sm">Adicione atividades extras à sua rotina!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
