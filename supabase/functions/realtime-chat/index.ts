import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgradeHeader = req.headers.get("upgrade") || "";
  
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  try {
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    
    console.log("Client WebSocket connection initiated");
    
    let openAISocket: WebSocket | null = null;
    let sessionReady = false;

    clientSocket.onopen = async () => {
      console.log("Client connected, establishing OpenAI connection");
      
      try {
        // Connect to OpenAI Realtime API
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (!OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY not configured');
        }

        openAISocket = new WebSocket(
          'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
          {
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'OpenAI-Beta': 'realtime=v1',
            }
          }
        );

        openAISocket.onopen = () => {
          console.log("Connected to OpenAI Realtime API");
        };

        openAISocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("OpenAI event:", data.type);

            // Send session.update after receiving session.created
            if (data.type === 'session.created' && !sessionReady) {
              console.log("Session created, sending configuration");
              sessionReady = true;
              
              const sessionUpdate = {
                type: 'session.update',
                session: {
                  modalities: ['text', 'audio'],
                  instructions: 'Você é o Orbis, um assistente financeiro inteligente e motivacional. Seu objetivo é ajudar vendedores, autônomos e pequenos empreendedores a dominarem suas finanças. Seja encorajador, direto e use dados quando possível. Fale em português brasileiro.',
                  voice: 'alloy',
                  input_audio_format: 'pcm16',
                  output_audio_format: 'pcm16',
                  input_audio_transcription: {
                    model: 'whisper-1'
                  },
                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 1000
                  },
                  temperature: 0.8,
                  max_response_output_tokens: 4096
                }
              };
              
              openAISocket?.send(JSON.stringify(sessionUpdate));
              console.log("Session configuration sent");
            }

            // Forward all messages to client
            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(event.data);
            }
          } catch (error) {
            console.error("Error processing OpenAI message:", error);
          }
        };

        openAISocket.onerror = (error) => {
          console.error("OpenAI WebSocket error:", error);
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ 
              type: 'error', 
              error: 'OpenAI connection error' 
            }));
          }
        };

        openAISocket.onclose = () => {
          console.log("OpenAI connection closed");
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.close();
          }
        };

      } catch (error) {
        console.error("Error establishing OpenAI connection:", error);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error'
          }));
          clientSocket.close();
        }
      }
    };

    clientSocket.onmessage = (event) => {
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      }
    };

    clientSocket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
    };

    clientSocket.onclose = () => {
      console.log("Client disconnected");
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.close();
      }
    };

    return response;

  } catch (error) {
    console.error("WebSocket upgrade error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
