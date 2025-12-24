import { useState, useCallback, useEffect, useRef } from "react";

interface UseSpeechRecognitionOptions {
  audioInputEnabled: boolean;
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
  error: string | null;
}

export function useSpeechRecognition({
  audioInputEnabled,
  onResult,
  onError,
  language = "pt-BR",
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const startListening = useCallback(() => {
    // RULE: Only start if audio_input_enabled = true
    if (!audioInputEnabled) {
      setError("Entrada por voz desativada nas configurações");
      onError?.("Entrada por voz desativada nas configurações");
      return;
    }

    if (!isSupported) {
      setError("Reconhecimento de voz não suportado neste navegador");
      onError?.("Reconhecimento de voz não suportado neste navegador");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Reconhecimento de voz não disponível");
      onError?.("Reconhecimento de voz não disponível");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        const result = event.results[0][0].transcript;
        setTranscript(result);
        onResult?.(result);
      };

      recognition.onerror = (event: any) => {
        let errorMessage = "Erro no reconhecimento de voz";
        
        switch (event.error) {
          case "not-allowed":
            errorMessage = "Permissão de microfone negada";
            break;
          case "no-speech":
            errorMessage = "Nenhuma fala detectada";
            break;
          case "audio-capture":
            errorMessage = "Nenhum microfone encontrado";
            break;
          case "network":
            errorMessage = "Erro de rede";
            break;
          case "aborted":
            errorMessage = "Reconhecimento cancelado";
            break;
        }
        
        setError(errorMessage);
        setIsListening(false);
        onError?.(errorMessage);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      // Fallback for errors
      setError("Não foi possível iniciar o reconhecimento de voz");
      setIsListening(false);
      onError?.("Não foi possível iniciar o reconhecimento de voz");
    }
  }, [audioInputEnabled, isSupported, language, onResult, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
    error,
  };
}
