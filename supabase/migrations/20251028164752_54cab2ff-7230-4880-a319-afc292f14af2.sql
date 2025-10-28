-- Create daily_checklist table for tracking daily routine completion
CREATE TABLE public.daily_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_name TEXT NOT NULL,
  activity_time TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.daily_checklist ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own checklist"
ON public.daily_checklist
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checklist items"
ON public.daily_checklist
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklist items"
ON public.daily_checklist
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checklist items"
ON public.daily_checklist
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_daily_checklist_updated_at
BEFORE UPDATE ON public.daily_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_daily_checklist_user_date ON public.daily_checklist(user_id, date DESC);