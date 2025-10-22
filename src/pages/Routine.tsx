import { useState, useEffect } from "react";
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
  const [stats, setStats] = useState({ sleepHours: "", workHours: "" });

  const [formData, setFormData] = useState({
    wakeTime: "",
    workStart: "",
    lunchTime: "",
    workEnd: "",
    sleepTime: "",
    notes: ""
  });

  // 🧮 Função para calcular horas
  const calculateHours = (start: string, end: string): string => {
    if (!start || !end) return "--h";
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    let diff = (endH * 60 + endM) - (startH * 60 + startM);
    if (diff < 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
  };

  // 🔄 Atualiza estatísticas sempre que mudar os horários
  useEffect(() => {
    const sleepHours = calculateHours(formData.sleepTime, formData.wakeTime);
    const workHours = calculateHours(formData.workStart, formData.workEnd);
    setStats({ sleepHours, workHours });
  }, [formData]);

  // 🚀 Enviar rotina para IA
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAiResponse("");

    try {
      const routineMessage = `
      Minha rotina atual:
      - Acordo às ${formData.wakeTime}
      - Começo a trabalhar às ${formData.workStart}
      - Almoço às ${formData.lunchTime}
      - Paro de vender às ${formData.workEnd}
      - Durmo às ${formData.sleepTime}.
      Total de sono: ${stats.sleepHours}, tempo de trabalho: ${stats.workHours}.
      Observações: ${formData.notes || "nenhuma"}.
      Analise e sugira melhorias para produtividade, energia e equilíbrio de vida.`;

      const { data, error } = await supabase.functions.invoke("realtime-chat", {
        body: { message: routineMessage }
      });

      if (error) throw error;
      setAiResponse(data?.response || "Rotina salva com sucesso!");

      toast({
        title: "Rotina enviada!",
        description: "O Orbis está analisando seus horários e energia.",
      });
    } catch (error) {
      console.error("Error:", error);
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
    <div className="min-h-screen p-6 bg-gradient-to-br from-background via-background/95 to-background/80 space-y-10 animate-fade-in">
      
      {/* 🔥 Título principal */}
      <div className="text-center space-y-3 mb-8">
        <h1 className="text-5xl font-bold text-primary tracking-tight drop-shadow-[0_0_20px_rgba(0,180,255,0.7)]">
          Domine seu futuro
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          Crie, analise e otimize sua rotina com o poder da IA Orbis ⚡
        </p>
      </div>

      {/* 📋 Formulário */}
      <Card className="card-gradient-border max-w-2xl mx-auto shadow-xl backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-semibold">
            <Clock className="h-5 w-5 text-primary" />
            Sua Rotina Diária
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { icon: <Sunrise className="h-4 w-4 text-primary" />, label: "Hora que acorda", key: "wakeTime" },
                { icon: <Briefcase className="h-4 w-4 text-secondary" />, label: "Hora que começa a trabalhar", key: "workStart" },
                { icon: <Utensils className="h-4 w-4 text-success" />, label: "Hora que almoça", key: "lunchTime" },
                { icon: <Sunset className="h-4 w-4 text-warning" />, label: "Hora que para de vender", key: "workEnd" },
                { icon: <Moon className="h-4 w-4 text-primary" />, label: "Hora que dorme", key: "sleepTime" },
              ].map(({ icon, label, key }) => (
                <div key={key} className="space-y-2">
                  <Label className="flex items-center gap-2">{icon}{label}</Label>
                  <Input
                    type="time"
                    value={formData[key as keyof typeof formData] as string}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    required
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Adicione detalhes: deslocamento, treino, descanso..."
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={4}
              />
            </div>

            <Button 
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:opacity-90 transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? "Analisando rotina..." : "Salvar e Analisar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 🧭 Linha do Tempo */}
      {(formData.wakeTime || formData.workStart || formData.workEnd || formData.sleepTime) && (
        <Card className="max-w-3xl mx-auto bg-gradient-to-br from-card/80 to-card/50 shadow-lg border border-primary/20 mt-10">
          <CardHeader>
            <CardTitle className="text-center text-primary font-semibold text-lg">
              🕓 Linha do Tempo Visionária
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center justify-between w-full mt-6">
              {[
                { icon: <Sunrise className="text-primary" />, label: "Acorda", time: formData.wakeTime },
                { icon: <Briefcase className="text-secondary" />, label: "Trabalha", time: formData.workStart },
                { icon: <Utensils className="text-success" />, label: "Almoça", time: formData.lunchTime },
                { icon: <Sunset className="text-warning" />, label: "Para", time: formData.workEnd },
                { icon: <Moon className="text-primary" />, label: "Dorme", time: formData.sleepTime },
              ].map(({ icon, label, time }, i, arr) => (
                <div key={label} className="flex flex-col items-center text-center relative">
                  <div className="p-3 bg-background rounded-full border border-primary/30 shadow-sm mb-2">
                    {icon}
                  </div>
                  <p className="text-xs md:text-sm font-medium text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{time || "--:--"}</p>

                  {i < arr.length - 1 && (
                    <div className="absolute top-5 left-[55%] w-[100%] h-[2px] bg-gradient-to-r from-primary/30 to-transparent -z-10" />
                  )}
                </div>
              ))}
            </div>

            {/* Estatísticas de horas */}
            <div className="flex flex-col md:flex-row justify-center gap-6 mt-8 text-center">
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">Horas de Sono</p>
                <p className="text-lg font-semibold text-primary">{stats.sleepHours}</p>
              </div>
              <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/20">
                <p className="text-sm text-muted-foreground">Horas de Trabalho</p>
                <p className="text-lg font-semibold text-secondary">{stats.workHours}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🤖 Análise da IA */}
      {aiResponse && (
        <Card className="card-gradient-border max-w-2xl mx-auto mt-10 bg-gradient-to-br from-card to-card/70 shadow-xl animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary text-xl font-semibold">
              💭 Análise do Orbis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {aiResponse}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
