-- Add telegram_chat_id to repair_orders
ALTER TABLE public.repair_orders
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Allow users to update their own future orders (>= 2 hours away)
CREATE POLICY "Users can update own future orders"
ON public.repair_orders
FOR UPDATE
USING (
  auth.uid() = user_id
  AND scheduled_at IS NOT NULL
  AND scheduled_at > now() + interval '2 hours'
)
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('waiting_diagnosis', 'waiting_price')
);

-- Allow users to delete (cancel) their own future orders (>= 2 hours away)
CREATE POLICY "Users can cancel own future orders"
ON public.repair_orders
FOR DELETE
USING (
  auth.uid() = user_id
  AND scheduled_at IS NOT NULL
  AND scheduled_at > now() + interval '2 hours'
  AND status IN ('waiting_diagnosis', 'waiting_price')
);