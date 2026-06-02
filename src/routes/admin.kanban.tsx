import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Loader2,
  ShieldAlert,
  Phone,
  User,
  Car,
  Calendar,
  Wrench,
  StickyNote,
  Banknote,
  Pencil,
  Save,
  X,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { sendTelegramNotification } from "@/lib/notify-telegram.functions";

export const Route = createFileRoute("/admin/kanban")({
  component: KanbanPage,
  head: () => ({
    meta: [{ title: "Kanban — заказы · Авто Premium" }],
  }),
});

type RepairStatus =
  | "waiting_diagnosis"
  | "waiting_price"
  | "waiting_parts"
  | "in_repair"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

type Order = {
  id: string;
  status: RepairStatus;
  client_name: string;
  client_phone: string;
  car_make: string;
  car_model: string;
  car_year: number | null;
  car_plate: string | null;
  service_id: string | null;
  scheduled_at: string | null;
  estimated_completion: string | null;
  assigned_master: string | null;
  notes: string | null;
  labor_cost: number;
  telegram_chat_id: string | null;
  user_id: string | null;
  created_at: string;
};

type Service = { id: string; name: string };

const COLUMNS: { id: RepairStatus; title: string; tone: string }[] = [
  { id: "waiting_diagnosis", title: "Ждёт диагностики", tone: "from-blue-500/15 to-blue-500/5 border-blue-500/30" },
  { id: "waiting_price", title: "Расчёт цены", tone: "from-amber-500/15 to-amber-500/5 border-amber-500/30" },
  { id: "waiting_parts", title: "Ждёт запчасти", tone: "from-orange-500/15 to-orange-500/5 border-orange-500/30" },
  { id: "in_repair", title: "В ремонте", tone: "from-purple-500/15 to-purple-500/5 border-purple-500/30" },
  { id: "ready_for_pickup", title: "Готов к выдаче", tone: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30" },
  { id: "completed", title: "Выполнен", tone: "from-green-500/15 to-green-500/5 border-green-500/30" },
  { id: "cancelled", title: "Отменён", tone: "from-rose-500/15 to-rose-500/5 border-rose-500/30" },
];

const STATUS_LABEL: Record<RepairStatus, string> = COLUMNS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.title }),
  {} as Record<RepairStatus, string>,
);

const STATUS_TEXT: Record<RepairStatus, string> = {
  waiting_diagnosis: "Ваша заявка принята и ожидает диагностики.",
  waiting_price: "Диагностика проведена, идёт расчёт стоимости ремонта.",
  waiting_parts: "Ожидаем поступление запчастей для вашего ремонта.",
  in_repair: "Ваш автомобиль в работе у мастера.",
  ready_for_pickup: "Ремонт завершён — автомобиль готов к выдаче!",
  completed: "Заказ закрыт. Спасибо, что выбрали нас!",
  cancelled: "Ваш заказ отменён. По вопросам свяжитесь с сервисом.",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function KanbanPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: o }, { data: s }] = await Promise.all([
      supabase
        .from("repair_orders")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("services").select("id,name").order("sort_order"),
    ]);
    setOrders((o ?? []) as Order[]);
    setServices(s ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const map: Record<RepairStatus, Order[]> = {
      waiting_diagnosis: [],
      waiting_price: [],
      waiting_parts: [],
      in_repair: [],
      ready_for_pickup: [],
      completed: [],
      cancelled: [],
    };
    orders.forEach((o) => map[o.status].push(o));
    return map;
  }, [orders]);

  const notifyClient = async (order: Order, newStatus: RepairStatus) => {
    if (!order.telegram_chat_id) return;
    const serviceName = services.find((s) => s.id === order.service_id)?.name ?? "Ремонт";
    const message =
      `🔔 <b>Обновление статуса заказа</b>\n\n` +
      `Услуга: <b>${serviceName}</b>\n` +
      `Авто: ${order.car_make} ${order.car_model}${order.car_year ? ` (${order.car_year})` : ""}\n` +
      `Новый статус: <b>${STATUS_LABEL[newStatus]}</b>\n\n` +
      `${STATUS_TEXT[newStatus]}\n\n` +
      `Подробности — в личном кабинете.`;
    try {
      await sendTelegramNotification({ data: { chatId: order.telegram_chat_id, message } });
    } catch (e: any) {
      console.warn("Telegram notify failed:", e?.message);
    }
  };

  const updateStatus = async (orderId: string, newStatus: RepairStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === newStatus) return;

    // Optimistic
    const prev = orders;
    setOrders((cur) => cur.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));

    const { error } = await supabase
      .from("repair_orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      setOrders(prev);
      toast.error("Не удалось обновить статус: " + error.message);
      return;
    }
    toast.success(`Статус → ${STATUS_LABEL[newStatus]}`);
    notifyClient(order, newStatus);
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const newStatus = String(overId) as RepairStatus;
    const orderId = String(e.active.id);
    updateStatus(orderId, newStatus);
  };

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <ShieldAlert className="h-16 w-16 text-primary" />
        <h1 className="font-display text-2xl font-bold">Доступ запрещён</h1>
        <Link to="/" className="text-sm text-primary hover:underline">← На главную</Link>
      </div>
    );
  }

  const activeOrder = activeId ? orders.find((o) => o.id === activeId) : null;

  return (
    <div className="min-h-screen bg-background pt-24 pb-10">
      <div className="mx-auto max-w-[1800px] px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                <ArrowLeft className="h-4 w-4" /> Админ
              </Link>
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold">Kanban — заказы</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Перетаскивайте карточки между колонками, чтобы менять статус. Клиенту с указанным Telegram уйдёт уведомление.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            Всего: <span className="font-semibold text-foreground">{orders.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {COLUMNS.map((col) => (
                <Column
                  key={col.id}
                  id={col.id}
                  title={col.title}
                  tone={col.tone}
                  count={grouped[col.id].length}
                >
                  {grouped[col.id].map((order) => (
                    <DraggableCard
                      key={order.id}
                      order={order}
                      service={services.find((s) => s.id === order.service_id)}
                      onEdit={() => setEditing(order)}
                      onStatus={(s) => updateStatus(order.id, s)}
                    />
                  ))}
                  {grouped[col.id].length === 0 && (
                    <div className="rounded-lg border border-dashed border-border/40 px-3 py-6 text-center text-xs text-muted-foreground">
                      Пусто
                    </div>
                  )}
                </Column>
              ))}
            </div>
            <DragOverlay>
              {activeOrder ? (
                <CardView
                  order={activeOrder}
                  service={services.find((s) => s.id === activeOrder.service_id)}
                  dragging
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {editing && (
        <EditModal
          order={editing}
          services={services}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Column({
  id,
  title,
  tone,
  count,
  children,
}: {
  id: RepairStatus;
  title: string;
  tone: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-[300px] shrink-0 flex-col rounded-xl border bg-gradient-to-b p-3 transition ${tone} ${
        isOver ? "ring-2 ring-primary/60" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="rounded-full bg-background/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2 min-h-[100px]">{children}</div>
    </div>
  );
}

function DraggableCard({
  order,
  service,
  onEdit,
  onStatus,
}: {
  order: Order;
  service?: Service;
  onEdit: () => void;
  onStatus: (s: RepairStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <CardView order={order} service={service} onEdit={onEdit} onStatus={onStatus} />
    </div>
  );
}

function CardView({
  order,
  service,
  onEdit,
  onStatus,
  dragging,
}: {
  order: Order;
  service?: Service;
  onEdit?: () => void;
  onStatus?: (s: RepairStatus) => void;
  dragging?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border/60 bg-card p-3 text-sm shadow-sm ${
        dragging ? "rotate-2 shadow-xl" : "hover:border-primary/40"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="font-semibold text-foreground line-clamp-1">
          {service?.name ?? "Без услуги"}
        </div>
        {onEdit && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-muted-foreground hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3" />
          <span className="truncate text-foreground">{order.client_name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone className="h-3 w-3" />
          <span>{order.client_phone}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Car className="h-3 w-3" />
          <span className="truncate">
            {order.car_make} {order.car_model}
            {order.car_year ? ` · ${order.car_year}` : ""}
            {order.car_plate ? ` · ${order.car_plate}` : ""}
          </span>
        </div>
        {order.scheduled_at && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            <span>Запись: {fmtDate(order.scheduled_at)}</span>
          </div>
        )}
        {order.estimated_completion && (
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3 w-3" />
            <span>Готов к: {fmtDate(order.estimated_completion)}</span>
          </div>
        )}
        {order.assigned_master && (
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3 w-3" />
            <span className="truncate">Мастер: {order.assigned_master}</span>
          </div>
        )}
        {order.labor_cost > 0 && (
          <div className="flex items-center gap-1.5">
            <Banknote className="h-3 w-3" />
            <span>{Number(order.labor_cost).toLocaleString("ru-RU")} ₸</span>
          </div>
        )}
        {order.notes && (
          <div className="flex items-start gap-1.5 pt-1 border-t border-border/40 mt-1">
            <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{order.notes}</span>
          </div>
        )}
      </div>

      {onStatus && (
        <div
          className="mt-3 flex flex-wrap gap-1"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {COLUMNS.filter((c) => c.id !== order.status).slice(0, 3).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onStatus(c.id)}
              className="rounded-md border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
            >
              → {c.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EditModal({
  order,
  services,
  onClose,
  onSaved,
}: {
  order: Order;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    assigned_master: order.assigned_master ?? "",
    labor_cost: String(order.labor_cost ?? 0),
    estimated_completion: order.estimated_completion
      ? new Date(order.estimated_completion).toISOString().slice(0, 16)
      : "",
    notes: order.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("repair_orders")
      .update({
        assigned_master: form.assigned_master.trim() || null,
        labor_cost: parseFloat(form.labor_cost) || 0,
        estimated_completion: form.estimated_completion
          ? new Date(form.estimated_completion).toISOString()
          : null,
        notes: form.notes.trim() || null,
      })
      .eq("id", order.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    onSaved();
  };

  const serviceName = services.find((s) => s.id === order.service_id)?.name ?? "Без услуги";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border/50 bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Редактировать заказ</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {serviceName} · {order.client_name}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Назначенный мастер</Label>
            <Input
              value={form.assigned_master}
              onChange={(e) => setForm({ ...form, assigned_master: e.target.value })}
              placeholder="Иван Иванов"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Стоимость работ (₸)</Label>
              <Input
                type="number"
                value={form.labor_cost}
                onChange={(e) => setForm({ ...form, labor_cost: e.target.value })}
              />
            </div>
            <div>
              <Label>Готов к (ETA)</Label>
              <Input
                type="datetime-local"
                value={form.estimated_completion}
                onChange={(e) => setForm({ ...form, estimated_completion: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Заметки мастера</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-gold-gradient text-primary-foreground"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Сохранить
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
