CREATE TABLE public.diagnostics_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  car_make TEXT NOT NULL,
  car_model TEXT NOT NULL,
  car_year TEXT,
  symptoms TEXT NOT NULL,
  urgency TEXT NOT NULL,
  summary TEXT NOT NULL,
  causes JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  advice TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diagnostics_history_user_id ON public.diagnostics_history(user_id);
CREATE INDEX idx_diagnostics_history_created_at ON public.diagnostics_history(created_at DESC);

ALTER TABLE public.diagnostics_history ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous) can save a diagnostic
CREATE POLICY "Anyone can insert diagnostics"
ON public.diagnostics_history
FOR INSERT
WITH CHECK (true);

-- Users can view their own diagnostics
CREATE POLICY "Users can view own diagnostics"
ON public.diagnostics_history
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all diagnostics
CREATE POLICY "Admins can view all diagnostics"
ON public.diagnostics_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can delete own diagnostics
CREATE POLICY "Users can delete own diagnostics"
ON public.diagnostics_history
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can delete any diagnostics
CREATE POLICY "Admins can delete any diagnostics"
ON public.diagnostics_history
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));