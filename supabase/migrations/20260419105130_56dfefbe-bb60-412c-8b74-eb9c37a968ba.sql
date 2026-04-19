
-- Status enum
CREATE TYPE public.repair_status AS ENUM (
  'waiting_diagnosis',
  'waiting_price',
  'waiting_parts',
  'in_repair',
  'ready_for_pickup',
  'completed',
  'cancelled'
);

-- Services catalog
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Services visible to all" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admins can insert services" ON public.services FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update services" ON public.services FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete services" ON public.services FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Repair orders
CREATE TABLE public.repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  car_make TEXT NOT NULL,
  car_model TEXT NOT NULL,
  car_year INTEGER,
  car_plate TEXT,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  status public.repair_status NOT NULL DEFAULT 'waiting_diagnosis',
  scheduled_at TIMESTAMPTZ,
  estimated_completion TIMESTAMPTZ,
  labor_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  assigned_master TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all orders" ON public.repair_orders FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own orders" ON public.repair_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert orders" ON public.repair_orders FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update orders" ON public.repair_orders FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete orders" ON public.repair_orders FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_repair_orders_updated_at
  BEFORE UPDATE ON public.repair_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_repair_orders_status ON public.repair_orders(status);
CREATE INDEX idx_repair_orders_user_id ON public.repair_orders(user_id);

-- Order parts (parts used in a repair)
CREATE TABLE public.repair_order_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_order_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all order parts" ON public.repair_order_parts FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own order parts" ON public.repair_order_parts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.repair_orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);
CREATE POLICY "Admins can insert order parts" ON public.repair_order_parts FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update order parts" ON public.repair_order_parts FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete order parts" ON public.repair_order_parts FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_repair_order_parts_order_id ON public.repair_order_parts(order_id);
