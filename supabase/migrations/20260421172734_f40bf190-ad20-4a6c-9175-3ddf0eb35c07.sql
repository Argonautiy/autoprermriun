-- Add slot duration to services
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60;

-- Index for fast slot lookup
CREATE INDEX IF NOT EXISTS idx_repair_orders_scheduled_at
ON public.repair_orders(scheduled_at)
WHERE scheduled_at IS NOT NULL;

-- Allow public/authenticated booking submission
CREATE POLICY "Anyone can book repair orders"
ON public.repair_orders
FOR INSERT
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);