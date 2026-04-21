import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

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

  // Load conversation list
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, title, last_message_at, created_at")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });
    if (error) {
      console.error("Failed to load conversations", error);
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
      toast({ title: "Erro ao criar conversa", variant: "destructive" });
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

  const sendMessage = useCallback(async (text: string) => {
    if (!user || !text.trim()) return;
    let convId = activeId;

    // Auto-create conversation if none active
    if (!convId) {
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

      const { data, error } = await supabase.functions.invoke("chat-with-ai", {
        body: { messages: history },
      });

      let aiText = "";
      if (error || !data?.success || !data?.message) {
        aiText =
          "Desculpe, tive um problema ao responder agora. Tente de novo em instantes.";
      } else {
        aiText = data.message;
      }

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
  };
};
