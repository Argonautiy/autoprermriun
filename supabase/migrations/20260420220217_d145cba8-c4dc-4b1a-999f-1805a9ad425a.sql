DROP POLICY IF EXISTS "Anyone can insert diagnostics" ON public.diagnostics_history;

CREATE POLICY "Insert own or anonymous diagnostics"
ON public.diagnostics_history
FOR INSERT
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);