import { useOnlineStatus } from "./useOnlineStatus";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

/**
 * Returns a guard function that shows a friendly message when offline
 * and returns false. Returns true if online.
 */
export function useOfflineGuard() {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  const requireOnline = useCallback((featureName?: string): boolean => {
    if (isOnline) return true;

    toast({
      title: "Sem conexão",
      description: featureName
        ? `${featureName} vai atualizar automaticamente quando você conectar ao Wi-Fi.`
        : "Você está sem conexão. Essa função vai atualizar automaticamente quando você conectar ao Wi-Fi.",
      duration: 4000,
    });
    return false;
  }, [isOnline, toast]);

  return { isOnline, requireOnline };
}
