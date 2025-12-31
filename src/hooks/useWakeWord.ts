import { useState, useEffect, useRef, useCallback } from "react";

interface UseWakeWordOptions {
  enabled: boolean;
  wakeWords?: string[];
  onWakeWordDetected: () => void;
}

export function useWakeWord({
  enabled,
  wakeWords = ["eae orbis", "ei orbis", "olá orbis", "oi orbis", "hey orbis"],
  onWakeWordDetected,
}: UseWakeWordOptions) {
  const [isPassiveListening, setIsPassiveListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const startPassiveListening = useCallback(() => {
    if (!enabled || !isSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        setIsPassiveListening(true);
      };

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          for (let j = 0; j < result.length; j++) {
            const transcript = result[j].transcript.toLowerCase().trim();
            
            // Check if any wake word is detected
            const detected = wakeWords.some((word) =>
              transcript.includes(word.toLowerCase())
            );

            if (detected) {
              recognition.stop();
              onWakeWordDetected();
              return;
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.log("Wake word detection error:", event.error);
        setIsPassiveListening(false);
        
        // Auto-restart after errors (except permission denied)
        if (event.error !== "not-allowed" && enabled) {
          restartTimeoutRef.current = setTimeout(() => {
            startPassiveListening();
          }, 1000);
        }
      };

      recognition.onend = () => {
        setIsPassiveListening(false);
        
        // Auto-restart if still enabled
        if (enabled) {
          restartTimeoutRef.current = setTimeout(() => {
            startPassiveListening();
          }, 500);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.log("Failed to start wake word detection:", error);
      setIsPassiveListening(false);
    }
  }, [enabled, isSupported, wakeWords, onWakeWordDetected]);

  const stopPassiveListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
      recognitionRef.current = null;
    }
    setIsPassiveListening(false);
  }, []);

  // Start/stop based on enabled state
  useEffect(() => {
    if (enabled && isSupported) {
      startPassiveListening();
    } else {
      stopPassiveListening();
    }

    return () => {
      stopPassiveListening();
    };
  }, [enabled, isSupported, startPassiveListening, stopPassiveListening]);

  return {
    isPassiveListening,
    isSupported,
    startPassiveListening,
    stopPassiveListening,
  };
}
