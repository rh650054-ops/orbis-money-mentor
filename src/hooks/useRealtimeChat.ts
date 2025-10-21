import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioRecorder, encodeAudioForAPI } from '@/utils/audioRecorder';
import { AudioQueue } from '@/utils/audioPlayer';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const useRealtimeChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentTranscriptRef = useRef<string>('');
  const currentAssistantMessageRef = useRef<string>('');

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  }, []);

  const connect = useCallback(async () => {
    try {
      console.log("Connecting to chat...");
      setError(null);

      // Initialize audio context and queue
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        audioQueueRef.current = new AudioQueue(audioContextRef.current);
        console.log("Audio context initialized");
      }

      // Connect WebSocket
      const ws = new WebSocket(
        'wss://qrmteadsrsdddbwuboly.supabase.co/functions/v1/realtime-chat'
      );

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received message:", data.type);

          switch (data.type) {
            case 'session.created':
              console.log("Session created successfully");
              break;

            case 'session.updated':
              console.log("Session configured");
              break;

            case 'input_audio_buffer.speech_started':
              console.log("User started speaking");
              setIsRecording(true);
              break;

            case 'input_audio_buffer.speech_stopped':
              console.log("User stopped speaking");
              setIsRecording(false);
              if (currentTranscriptRef.current) {
                addMessage('user', currentTranscriptRef.current);
                currentTranscriptRef.current = '';
              }
              break;

            case 'conversation.item.input_audio_transcription.completed':
              console.log("Transcription:", data.transcript);
              currentTranscriptRef.current = data.transcript;
              break;

            case 'response.audio.delta':
              if (data.delta && audioQueueRef.current) {
                const binaryString = atob(data.delta);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                await audioQueueRef.current.addToQueue(bytes);
              }
              break;

            case 'response.audio_transcript.delta':
              currentAssistantMessageRef.current += data.delta || '';
              break;

            case 'response.audio_transcript.done':
              if (currentAssistantMessageRef.current) {
                addMessage('assistant', currentAssistantMessageRef.current);
                currentAssistantMessageRef.current = '';
              }
              break;

            case 'response.created':
              console.log("AI started responding");
              setIsSpeaking(true);
              break;

            case 'response.done':
              console.log("AI finished responding");
              setIsSpeaking(false);
              break;

            case 'error':
              console.error("Session error:", data.error);
              setError(data.error?.message || 'An error occurred');
              break;
          }
        } catch (error) {
          console.error("Error processing message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("Connection error");
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        setIsRecording(false);
        setIsSpeaking(false);
      };

      wsRef.current = ws;

      // Start audio recording
      const recorder = new AudioRecorder((audioData) => {
        if (ws.readyState === WebSocket.OPEN) {
          const base64Audio = encodeAudioForAPI(audioData);
          ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Audio
          }));
        }
      });

      await recorder.start();
      recorderRef.current = recorder;
      console.log("Audio recording started");

    } catch (error) {
      console.error("Connection error:", error);
      setError(error instanceof Error ? error.message : 'Failed to connect');
      setIsConnected(false);
    }
  }, [addMessage]);

  const disconnect = useCallback(() => {
    console.log("Disconnecting...");
    
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (audioQueueRef.current) {
      audioQueueRef.current.clear();
    }

    setIsConnected(false);
    setIsRecording(false);
    setIsSpeaking(false);
    currentTranscriptRef.current = '';
    currentAssistantMessageRef.current = '';
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return;
    }

    console.log("Sending text message:", text);
    addMessage('user', text);

    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text
        }]
      }
    };

    wsRef.current.send(JSON.stringify(event));
    wsRef.current.send(JSON.stringify({ type: 'response.create' }));
  }, [addMessage]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    messages,
    isConnected,
    isRecording,
    isSpeaking,
    error,
    connect,
    disconnect,
    sendTextMessage
  };
};
