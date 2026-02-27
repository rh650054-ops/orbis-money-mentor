import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useGoogleCalendar = (userId: string | undefined) => {
  const [isConnected, setIsConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      checkConnection();
    }
  }, [userId]);

  const checkConnection = async () => {
    if (!userId) return;

    const { data } = await supabase
      .from("google_calendar_tokens")
      .select("google_email")
      .eq("user_id", userId)
      .single();

    if (data) {
      setIsConnected(true);
      setGoogleEmail(data.google_email);
    }
  };

  const connect = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { origin: window.location.origin },
      });

      if (error) throw error;

      const authWindow = window.open(
        data.authUrl,
        "Google Calendar Authorization",
        "width=600,height=700"
      );

      // Listen for the OAuth callback with origin validation
      const expectedOrigin = window.location.origin;
      const handleMessage = (event: MessageEvent) => {
        // Validate message origin - only accept from our own origin or the Supabase functions domain
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (event.origin !== expectedOrigin && event.origin !== supabaseUrl) {
          return;
        }
        if (event.data.type === "google-calendar-success") {
          setIsConnected(true);
          setGoogleEmail(event.data.email);
          toast({
            title: "✅ Conectado!",
            description: `Google Calendar conectado: ${event.data.email}`,
          });
          window.removeEventListener("message", handleMessage);
        } else if (event.data.type === "google-calendar-error") {
          toast({
            title: "Erro ao conectar",
            description: event.data.error,
            variant: "destructive",
          });
          window.removeEventListener("message", handleMessage);
        }
      };

      window.addEventListener("message", handleMessage);

      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener("message", handleMessage);
          setLoading(false);
        }
      }, 500);
    } catch (error) {
      console.error("Error connecting to Google Calendar:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao conectar",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (!userId) return;

    const { error } = await supabase
      .from("google_calendar_tokens")
      .delete()
      .eq("user_id", userId);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao desconectar",
        variant: "destructive",
      });
      return;
    }

    setIsConnected(false);
    setGoogleEmail(null);
    toast({
      title: "Desconectado",
      description: "Google Calendar desconectado com sucesso",
    });
  };

  return {
    isConnected,
    googleEmail,
    loading,
    connect,
    disconnect,
  };
};