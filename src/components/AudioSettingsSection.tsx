import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Volume2, AlertCircle } from "lucide-react";
import { useAudioSettings, AudioSettings } from "@/hooks/useAudioSettings";
import { useToast } from "@/hooks/use-toast";

interface AudioSettingsSectionProps {
  userId: string | undefined;
}

export function AudioSettingsSection({ userId }: AudioSettingsSectionProps) {
  const { settings, loading, updateSettings, isSpeechSupported, isMicSupported } = useAudioSettings(userId);
  const { toast } = useToast();

  const handleToggleInput = async (enabled: boolean) => {
    if (enabled && !isMicSupported) {
      toast({
        title: "Microfone não suportado",
        description: "Seu navegador ou dispositivo não suporta entrada por voz.",
        variant: "destructive",
      });
      return;
    }

    // Request microphone permission if enabling
    if (enabled && isMicSupported) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        toast({
          title: "Permissão negada",
          description: "Por favor, permita o acesso ao microfone para usar entrada por voz.",
          variant: "destructive",
        });
        return;
      }
    }

    const success = await updateSettings({ audioInputEnabled: enabled });
    if (success) {
      toast({
        title: enabled ? "Entrada por voz ativada" : "Entrada por voz desativada",
        description: enabled ? "Você pode usar o microfone nos blocos de hora." : "",
      });
    }
  };

  const handleToggleOutput = async (enabled: boolean) => {
    if (enabled && !isSpeechSupported) {
      toast({
        title: "Síntese de voz não suportada",
        description: "Seu navegador não suporta respostas por voz. Os textos serão exibidos normalmente.",
        variant: "destructive",
      });
      return;
    }

    const success = await updateSettings({ audioOutputEnabled: enabled });
    if (success) {
      toast({
        title: enabled ? "Respostas por voz ativadas" : "Respostas por voz desativadas",
      });
    }
  };

  const handleRateChange = async (value: AudioSettings["speechRate"]) => {
    await updateSettings({ speechRate: value });
  };

  const handleVolumeChange = async (value: AudioSettings["speechVolume"]) => {
    await updateSettings({ speechVolume: value });
  };

  if (loading) {
    return (
      <Card className="glass">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-8 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-primary" />
          Configurações de Áudio
        </CardTitle>
        <CardDescription>
          Configure entrada e saída de voz para os blocos de hora
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Entrada por Voz */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="voice-input" className="text-base font-medium">
                  Entrada por voz
                </Label>
                <p className="text-sm text-muted-foreground">
                  Fale os valores ao invés de digitar
                </p>
              </div>
            </div>
            <Switch
              id="voice-input"
              checked={settings.audioInputEnabled}
              onCheckedChange={handleToggleInput}
              disabled={!isMicSupported}
            />
          </div>
          {!isMicSupported && (
            <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 p-2 rounded">
              <AlertCircle className="w-4 h-4" />
              <span>Microfone não disponível neste dispositivo</span>
            </div>
          )}
        </div>

        {/* Resposta por Voz */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="voice-output" className="text-base font-medium">
                  Respostas por voz
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ouça confirmações e mensagens em áudio
                </p>
              </div>
            </div>
            <Switch
              id="voice-output"
              checked={settings.audioOutputEnabled}
              onCheckedChange={handleToggleOutput}
            />
          </div>

          {/* Configurações de Voz (visível quando ativo) */}
          {settings.audioOutputEnabled && (
            <div className="ml-8 space-y-4 animate-in fade-in duration-200">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="speech-rate">Velocidade da fala</Label>
                  <Select
                    value={settings.speechRate}
                    onValueChange={handleRateChange}
                  >
                    <SelectTrigger id="speech-rate">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slow">Lenta</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="fast">Rápida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="speech-volume">Volume</Label>
                  <Select
                    value={settings.speechVolume}
                    onValueChange={handleVolumeChange}
                  >
                    <SelectTrigger id="speech-volume">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixo</SelectItem>
                      <SelectItem value="medium">Médio</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!isSpeechSupported && (
                <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 p-2 rounded">
                  <AlertCircle className="w-4 h-4" />
                  <span>Síntese de voz não suportada - apenas texto será exibido</span>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          💡 A resposta em texto sempre será exibida, a voz é complementar.
        </p>
      </CardContent>
    </Card>
  );
}
