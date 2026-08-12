import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/shared/ui/use-toast";
import { buildOrbisUserContext } from "@/shared/lib/orbis-user-context";

export interface AIConversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
}

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export const useAIConversations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // Ação que o servidor manda junto com a resposta (ex.: abrir o Estúdio com o briefing do adesivo)
  const [action, setAction] = useState<{ tipo: string; dados?: Record<string, string> } | null>(null);
  const clearAction = useCallback(() => setAction(null), []);
  const skipNextLoadRef = useRef(false);
  const userCtxRef = useRef<{ ctx: string; ts: number } | null>(null); // cache do contexto do vendedor

  // Load conversation list
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, title, last_message_at, created_at")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });
    if (error) {
      // Silently ignore if table doesn't exist yet (42P01)
      if (error.code !== '42P01') console.error("Failed to load conversations", error);
      return;
    }
    setConversations(data || []);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
    setIsLoading(true);
    supabase
      .from("ai_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setMessages((data as AIMessage[]) || []);
        setIsLoading(false);
      })
      .then(undefined, (err) => {
        console.error("Failed to load messages", err);
        setIsLoading(false);
      });
  }, [activeId]);

  const createConversation = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, title: "Nova conversa" })
      .select()
      .single();
    if (error || !data) {
      console.error("Erro ao criar conversa:", error?.code, error?.message, error?.details);
      if (error?.code === '42P01') {
        toast({ title: "Tabela de conversas não encontrada", description: "Execute as migrations no painel do Supabase.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao criar conversa", description: error?.message ?? "Tente novamente.", variant: "destructive" });
      }
      return null;
    }
    await loadConversations();
    setActiveId(data.id);
    return data.id;
  }, [user, loadConversations, toast]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    if (!user) return;
    await supabase.from("ai_conversations").update({ title }).eq("id", id);
    await loadConversations();
  }, [user, loadConversations]);

  const deleteConversation = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from("ai_conversations").delete().eq("id", id);
    if (activeId === id) setActiveId(null);
    await loadConversations();
  }, [user, activeId, loadConversations]);

  const sendMessage = useCallback(async (text: string, opts?: { voz?: boolean }) => {
    if (!user || !text.trim()) return;
    let convId = activeId;

    // Auto-create conversation if none active
    if (!convId) {
      skipNextLoadRef.current = true;
      convId = await createConversation();
      if (!convId) return;
    }

    setIsSending(true);

    // Optimistic user message
    const tempUser: AIMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);

    try {
      // Persist user message
      const { data: insertedUser } = await supabase
        .from("ai_messages")
        .insert({ conversation_id: convId, user_id: user.id, role: "user", content: text })
        .select()
        .single();
      if (insertedUser) {
        setMessages((prev) => prev.map((m) => (m.id === tempUser.id ? (insertedUser as AIMessage) : m)));
      }

      // If first message, set title from text (first 40 chars)
      const conv = conversations.find((c) => c.id === convId);
      if (conv && conv.title === "Nova conversa") {
        const newTitle = text.slice(0, 40) + (text.length > 40 ? "..." : "");
        await renameConversation(convId, newTitle);
      }

      // Build conversation history for AI
      const history = [...messages, tempUser].map((m) => ({ role: m.role, content: m.content }));

      // Contexto com os números reais do vendedor (cache de 3 min pra não pesar a cada msg)
      let userContext = "";
      try {
        const now = Date.now();
        if (userCtxRef.current && now - userCtxRef.current.ts < 180000) {
          userContext = userCtxRef.current.ctx;
        } else {
          userContext = await buildOrbisUserContext(user.id);
          userCtxRef.current = { ctx: userContext, ts: now };
        }
      } catch { userContext = ""; }

      // Tenta o chat; se falhar (timeout/limite), tenta +1 vez antes de desistir.
      // Reduz bastante o "Desculpe, tive um problema..." aparecer/ser falado na voz.
      let chatMessage = "";
      let chatAction: { tipo: string; dados?: Record<string, string> } | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data, error } = await supabase.functions.invoke("bright-action", {
          body: { messages: history, context: userContext, voz: !!opts?.voz },
        });
        if (!error && data?.success && data?.message) {
          chatMessage = data.message as string;
          if ((data as any)?.acao?.tipo) chatAction = (data as any).acao;
          break;
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
      }
      if (chatAction) setAction(chatAction);
      const aiText =
        chatMessage ||
        "Desculpe, tive um problema ao responder agora. Tente de novo em instantes.";

      const { data: insertedAi } = await supabase
        .from("ai_messages")
        .insert({ conversation_id: convId, user_id: user.id, role: "assistant", content: aiText })
        .select()
        .single();
      if (insertedAi) {
        setMessages((prev) => [...prev, insertedAi as AIMessage]);
      }
      await loadConversations();
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }, [user, activeId, messages, conversations, createConversation, renameConversation, loadConversations, toast]);

  return {
    conversations,
    activeId,
    setActiveId,
    messages,
    isLoading,
    isSending,
    createConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
    action,
    clearAction,
  };
};
