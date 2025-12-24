-- Add audio settings columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS audio_input_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS audio_output_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS speech_rate text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS speech_volume text DEFAULT 'medium';