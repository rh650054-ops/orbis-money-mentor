import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AudioSettings {
  audioInputEnabled: boolean;
  audioOutputEnabled: boolean;
  speechRate: "slow" | "normal" | "fast";
  speechVolume: "low" | "medium" | "high";
}

const defaultSettings: AudioSettings = {
  audioInputEnabled: false,
  audioOutputEnabled: false,
  speechRate: "normal",
  speechVolume: "medium",
};

export function useAudioSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<AudioSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isMicSupported, setIsMicSupported] = useState(false);

  // Check browser support
  useEffect(() => {
    setIsSpeechSupported("speechSynthesis" in window);
    setIsMicSupported("mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices);
  }, []);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("audio_input_enabled, audio_output_enabled, speech_rate, speech_volume")
      .eq("user_id", userId)
      .single();

    if (data && !error) {
      setSettings({
        audioInputEnabled: data.audio_input_enabled ?? false,
        audioOutputEnabled: data.audio_output_enabled ?? false,
        speechRate: (data.speech_rate as AudioSettings["speechRate"]) ?? "normal",
        speechVolume: (data.speech_volume as AudioSettings["speechVolume"]) ?? "medium",
      });
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Update settings in database
  const updateSettings = async (newSettings: Partial<AudioSettings>) => {
    if (!userId) return false;

    const updatedSettings = { ...settings, ...newSettings };

    const { error } = await supabase
      .from("profiles")
      .update({
        audio_input_enabled: updatedSettings.audioInputEnabled,
        audio_output_enabled: updatedSettings.audioOutputEnabled,
        speech_rate: updatedSettings.speechRate,
        speech_volume: updatedSettings.speechVolume,
      })
      .eq("user_id", userId);

    if (!error) {
      setSettings(updatedSettings);
      return true;
    }

    return false;
  };

  // Speak text using Web Speech API
  const speak = useCallback(
    (text: string) => {
      if (!settings.audioOutputEnabled || !isSpeechSupported) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";

      // Set rate based on settings
      switch (settings.speechRate) {
        case "slow":
          utterance.rate = 0.7;
          break;
        case "fast":
          utterance.rate = 1.3;
          break;
        default:
          utterance.rate = 1.0;
      }

      // Set volume based on settings
      switch (settings.speechVolume) {
        case "low":
          utterance.volume = 0.3;
          break;
        case "high":
          utterance.volume = 1.0;
          break;
        default:
          utterance.volume = 0.7;
      }

      window.speechSynthesis.speak(utterance);
    },
    [settings, isSpeechSupported]
  );

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (isSpeechSupported) {
      window.speechSynthesis.cancel();
    }
  }, [isSpeechSupported]);

  return {
    settings,
    loading,
    updateSettings,
    speak,
    stopSpeaking,
    isSpeechSupported,
    isMicSupported,
  };
}
