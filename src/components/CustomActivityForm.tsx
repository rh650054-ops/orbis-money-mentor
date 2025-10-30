import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const activitySchema = z.object({
  name: z.string()
    .trim()
    .min(1, { message: "Nome da atividade não pode estar vazio" })
    .max(200, { message: "Nome deve ter no máximo 200 caracteres" }),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário de início inválido" }),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Horário de fim inválido" }),
  category: z.enum(["trabalho", "saude", "lazer", "estudo", "outro"]),
  emoji: z.string().min(1, { message: "Escolha um emoji" }),
  notes: z.string().max(500, { message: "Observações devem ter no máximo 500 caracteres" }).optional()
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

interface Activity {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  category: string;
  emoji: string;
  notes: string;
}

interface CustomActivityFormProps {
  userId: string;
  activities: Activity[];
  onActivitiesChange: () => void;
}

export default function CustomActivityForm({ userId, activities, onActivitiesChange }: CustomActivityFormProps) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
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
      // Validate form data
      const validation = activitySchema.safeParse(formData);
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast({
          title: "Erro de validação",
          description: firstError.message,
          variant: "destructive"
        });
        return;
      }

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

      toast({
        title: "Atividade adicionada!",
        description: `${formData.name} foi adicionada à sua rotina.`,
      });

      setFormData({
        name: "",
        startTime: "",
        endTime: "",
        category: "trabalho",
        emoji: "💪",
        notes: ""
      });
      setIsAdding(false);
      onActivitiesChange();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error:", error);
      }
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a atividade.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("routine_activities")
        .delete()
        .eq("id", activityId);

      if (error) throw error;

      toast({
        title: "Atividade removida!",
        description: "A atividade foi removida da sua rotina.",
      });

      onActivitiesChange();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error:", error);
      }
      toast({
        title: "Erro",
        description: "Não foi possível remover a atividade.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="card-gradient-border shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Atividades Personalizadas</CardTitle>
          {!isAdding && (
            <Button 
              type="button"
              onClick={() => setIsAdding(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              ➕ Adicionar Atividade
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de atividades existentes */}
        {activities.length > 0 && (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div 
                key={activity.id}
                className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border"
              >
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2">
                    <span className="text-2xl">{activity.emoji}</span>
                    {activity.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activity.start_time} - {activity.end_time} • {activity.category}
                  </p>
                  {activity.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{activity.notes}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(activity.id)}
                  className="hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Formulário de nova atividade */}
        {isAdding && (
          <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-card/30 rounded-lg border border-primary/20">
            <div className="space-y-2">
              <Label>Nome da Atividade</Label>
              <Input
                type="text"
                placeholder="Ex: Treinar, Estudar, Postar conteúdo..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={200}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Horário de Início</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Horário de Fim</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Emoji Visionário</Label>
              <div className="grid grid-cols-6 gap-2">
                {EMOJI_OPTIONS.map((option) => (
                  <button
                    key={option.emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, emoji: option.emoji })}
                    className={`text-3xl p-2 rounded-lg border-2 transition-smooth hover:scale-110 ${
                      formData.emoji === option.emoji 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-primary/50"
                    }`}
                    title={option.label}
                  >
                    {option.emoji}
                  </button>
                ))}
              </div>
              <Input
                type="text"
                placeholder="Ou digite seu próprio emoji..."
                value={formData.emoji}
                onChange={(e) => setFormData({ ...formData, emoji: e.target.value.substring(0, 2) })}
                className="text-center text-2xl"
                maxLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trabalho">Trabalho</SelectItem>
                  <SelectItem value="saude">Saúde</SelectItem>
                  <SelectItem value="lazer">Lazer</SelectItem>
                  <SelectItem value="estudo">Estudo</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Detalhes sobre a atividade..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                maxLength={500}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                type="submit"
                className="flex-1"
              >
                ✅ Salvar Atividade
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={() => setIsAdding(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
