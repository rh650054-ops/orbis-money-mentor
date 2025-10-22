import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Sunrise, Briefcase, Utensils, Sunset, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Routine() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [formData, setFormData] = useState({
    wakeTime: "",
    workStart: "",
    lunchTime: "",
    workEnd: "",
    sleepTime: "",
    notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAiResponse("");

    try {
      const routineMessage = `Minha rotina: acordo às ${formData.wakeTime}, começo a trabalhar às ${formData.workStart}, almoço às ${formData.lunchTime}, paro de vender às ${formData.workEnd}, durmo às ${formData.sleepTime}. Observações: ${formData.notes || "nenhuma"}. Analise minha rotina e sugira melhorias.`;

      const { data, error } = await supabase.functions.invoke('realtime-chat', {
        body: { message: routineMessage }
      });

      if (error) throw error;

      setAiResponse(data?.response || "Rotina salva com sucesso!");
      
      toast({
        title: "Rotina salva!",
        description: "A IA Orbis analisou sua rotina.",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a rotina.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Minha Rotina
        </h1>
        <p className="text-muted-foreground">
          Defina sua rotina diária para receber análises personalizadas
        </p>
      </div>

      <Card className="card-gradient-border max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Horários do Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Sunrise className="h-4 w-4 text-primary" />
                  Hora que acorda
                </Label>
                <Input
                  type="time"
                  value={formData.wakeTime}
                  onChange={(e) => setFormData({...formData, wakeTime: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-secondary" />
                  Hora que começa a trabalhar
                </Label>
                <Input
                  type="time"
                  value={formData.workStart}
                  onChange={(e) => setFormData({...formData, workStart: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-success" />
                  Hora que almoça
                </Label>
                <Input
                  type="time"
                  value={formData.lunchTime}
                  onChange={(e) => setFormData({...formData, lunchTime: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Sunset className="h-4 w-4 text-secondary" />
                  Hora que para de vender
                </Label>
                <Input
                  type="time"
                  value={formData.workEnd}
                  onChange={(e) => setFormData({...formData, workEnd: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-primary" />
                  Hora que dorme
                </Label>
                <Input
                  type="time"
                  value={formData.sleepTime}
                  onChange={(e) => setFormData({...formData, sleepTime: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Adicione qualquer informação adicional sobre sua rotina..."
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={4}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Analisando..." : "Salvar Rotina"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {aiResponse && (
        <Card className="card-gradient-border max-w-2xl mx-auto bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              🧠 Análise do Orbis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {aiResponse}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
