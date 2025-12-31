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
  const isStoppedRef = useRef(false);
  const enabledRef = useRef(enabled);

  // Keep enabledRef in sync
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const stopPassiveListening = useCallback(() => {
    isStoppedRef.current = true;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore errors when stopping
      }
      recognitionRef.current = null;
    }
    setIsPassiveListening(false);
  }, []);

  const startPassiveListening = useCallback(() => {
    if (!enabledRef.current || !isSupported) return;
    
    // Don't start if already listening
    if (recognitionRef.current) return;

    isStoppedRef.current = false;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = false; // Changed to false to prevent infinite loops
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        if (!isStoppedRef.current) {
          setIsPassiveListening(true);
        }
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
              stopPassiveListening();
              onWakeWordDetected();
              return;
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.log("Wake word detection error:", event.error);
        setIsPassiveListening(false);
        recognitionRef.current = null;
        
        // Only restart for recoverable errors, not permission denied or aborted
        if (event.error !== "not-allowed" && event.error !== "aborted" && enabledRef.current && !isStoppedRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (enabledRef.current && !isStoppedRef.current) {
              startPassiveListening();
            }
          }, 2000);
        }
      };

      recognition.onend = () => {
        setIsPassiveListening(false);
        recognitionRef.current = null;
        
        // Only restart if still enabled and not manually stopped
        if (enabledRef.current && !isStoppedRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (enabledRef.current && !isStoppedRef.current) {
              startPassiveListening();
            }
          }, 1000);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.log("Failed to start wake word detection:", error);
      setIsPassiveListening(false);
      recognitionRef.current = null;
    }
  }, [isSupported, wakeWords, onWakeWordDetected, stopPassiveListening]);

  // Start/stop based on enabled state
  useEffect(() => {
    if (enabled && isSupported) {
      // Delay start to avoid conflicts
      const timer = setTimeout(() => {
        startPassiveListening();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      stopPassiveListening();
    }

    return () => {
      stopPassiveListening();
    };
  }, [enabled, isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPassiveListening();
    };
  }, [stopPassiveListening]);

  return {
    isPassiveListening,
    isSupported,
    startPassiveListening,
    stopPassiveListening,
  };
}
